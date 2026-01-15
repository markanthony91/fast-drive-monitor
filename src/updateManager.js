/**
 * UpdateManager - Gerenciador de atualizações via Git
 *
 * Permite atualizar o sistema remotamente via API
 */

const { EventEmitter } = require('events');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class UpdateManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      repoDir: options.repoDir || process.cwd(),
      branch: options.branch || 'main',
      remote: options.remote || 'origin',
      autoRestart: options.autoRestart !== false,
      ...options
    };

    this.updateInProgress = false;
    this.lastCheck = null;
    this.lastUpdate = null;
    this.currentVersion = null;
  }

  /**
   * Inicializa o manager
   */
  async initialize() {
    try {
      // Carregar versão atual do package.json
      const pkgPath = path.join(this.options.repoDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        this.currentVersion = pkg.version;
      }

      console.log(`[UpdateManager] Inicializado - versão ${this.currentVersion}`);
      return true;
    } catch (error) {
      console.error('[UpdateManager] Erro na inicialização:', error);
      return false;
    }
  }

  /**
   * Executa comando e retorna promise
   */
  _execAsync(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.options.repoDir, ...options }, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stdout, stderr });
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        }
      });
    });
  }

  /**
   * Verifica se há atualizações disponíveis
   */
  async checkForUpdates() {
    if (this.updateInProgress) {
      return { available: false, message: 'Atualização em andamento' };
    }

    try {
      // Fetch do remote
      await this._execAsync(`git fetch ${this.options.remote}`);

      // Verificar diferenças
      const { stdout: localCommit } = await this._execAsync('git rev-parse HEAD');
      const { stdout: remoteCommit } = await this._execAsync(
        `git rev-parse ${this.options.remote}/${this.options.branch}`
      );

      // Contar commits de diferença
      const { stdout: behindCount } = await this._execAsync(
        `git rev-list HEAD..${this.options.remote}/${this.options.branch} --count`
      );

      this.lastCheck = Date.now();

      const behind = parseInt(behindCount) || 0;

      if (behind > 0) {
        // Obter log dos commits pendentes
        const { stdout: pendingCommits } = await this._execAsync(
          `git log HEAD..${this.options.remote}/${this.options.branch} --oneline`
        );

        return {
          available: true,
          currentCommit: localCommit,
          latestCommit: remoteCommit,
          behind,
          pendingCommits: pendingCommits.split('\n').filter(Boolean),
          message: `${behind} atualização(ões) disponível(is)`
        };
      }

      return {
        available: false,
        currentCommit: localCommit,
        message: 'Sistema está atualizado'
      };
    } catch (error) {
      console.error('[UpdateManager] Erro ao verificar atualizações:', error);
      return {
        available: false,
        error: true,
        message: `Erro ao verificar: ${error.error?.message || error.message}`
      };
    }
  }

  /**
   * Aplica atualizações
   */
  async applyUpdate() {
    if (this.updateInProgress) {
      return { success: false, message: 'Atualização já em andamento' };
    }

    this.updateInProgress = true;
    this.emit('updateStarted');

    try {
      console.log('[UpdateManager] Iniciando atualização...');

      // Salvar commit atual para rollback
      const { stdout: previousCommit } = await this._execAsync('git rev-parse HEAD');

      // Fazer pull
      const { stdout: pullOutput } = await this._execAsync(
        `git pull ${this.options.remote} ${this.options.branch}`
      );

      console.log('[UpdateManager] Git pull:', pullOutput);

      // Verificar se package.json mudou (precisa reinstalar deps)
      const { stdout: changedFiles } = await this._execAsync(
        `git diff ${previousCommit} HEAD --name-only`
      );

      const needsNpmInstall = changedFiles.includes('package.json') ||
        changedFiles.includes('package-lock.json');

      if (needsNpmInstall) {
        console.log('[UpdateManager] Instalando dependências...');
        await this._execAsync('npm install --production');
      }

      // Obter nova versão
      const pkgPath = path.join(this.options.repoDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const newVersion = pkg.version;

      this.lastUpdate = Date.now();
      this.updateInProgress = false;

      const result = {
        success: true,
        previousVersion: this.currentVersion,
        newVersion,
        previousCommit,
        changedFiles: changedFiles.split('\n').filter(Boolean),
        needsRestart: true,
        message: `Atualizado de ${this.currentVersion} para ${newVersion}`
      };

      this.currentVersion = newVersion;

      console.log(`[UpdateManager] ${result.message}`);
      this.emit('updateCompleted', result);

      // Auto restart se configurado
      if (this.options.autoRestart) {
        console.log('[UpdateManager] Reiniciando em 3 segundos...');
        setTimeout(() => {
          this.restartService();
        }, 3000);
      }

      return result;
    } catch (error) {
      this.updateInProgress = false;
      console.error('[UpdateManager] Erro na atualização:', error);

      this.emit('updateFailed', error);

      return {
        success: false,
        error: true,
        message: `Erro na atualização: ${error.error?.message || error.message}`
      };
    }
  }

  /**
   * Reinicia o serviço
   */
  restartService() {
    console.log('[UpdateManager] Reiniciando serviço...');

    if (os.platform() === 'win32') {
      // Windows - reiniciar via NSSM ou PM2
      exec('nssm restart FastDriveMonitor', (error) => {
        if (error) {
          // Tentar via PM2
          exec('pm2 restart fast-drive', (error2) => {
            if (error2) {
              // Fallback: reiniciar o processo Node
              process.exit(0);
            }
          });
        }
      });
    } else {
      // Linux/Mac - apenas sair (systemd ou supervisor reiniciará)
      process.exit(0);
    }
  }

  /**
   * Obtém status do sistema de updates
   */
  getStatus() {
    return {
      currentVersion: this.currentVersion,
      updateInProgress: this.updateInProgress,
      lastCheck: this.lastCheck,
      lastUpdate: this.lastUpdate,
      repoDir: this.options.repoDir,
      branch: this.options.branch,
      remote: this.options.remote
    };
  }

  /**
   * Faz rollback para commit anterior
   */
  async rollback(commitHash) {
    if (this.updateInProgress) {
      return { success: false, message: 'Operação em andamento' };
    }

    try {
      this.updateInProgress = true;

      await this._execAsync(`git reset --hard ${commitHash}`);
      await this._execAsync('npm install --production');

      this.updateInProgress = false;

      return {
        success: true,
        message: `Rollback para ${commitHash} concluído`
      };
    } catch (error) {
      this.updateInProgress = false;
      return {
        success: false,
        message: `Erro no rollback: ${error.message}`
      };
    }
  }
}

module.exports = { UpdateManager };
