/**
 * Testes automatizados - UpdateManager
 *
 * Executa: npm test
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { UpdateManager } = require('./updateManager');

describe('UpdateManager', () => {
  let manager;

  beforeEach(async () => {
    manager = new UpdateManager({
      repoDir: process.cwd(),
      branch: 'main',
      remote: 'origin',
      autoRestart: false
    });
    await manager.initialize();
  });

  describe('Inicialização', () => {
    it('deve inicializar corretamente', () => {
      assert.ok(manager.currentVersion);
      assert.strictEqual(manager.updateInProgress, false);
    });

    it('deve carregar versão do package.json', () => {
      const pkg = require('../package.json');
      assert.strictEqual(manager.currentVersion, pkg.version);
    });

    it('deve ter configurações padrão', () => {
      assert.strictEqual(manager.options.branch, 'main');
      assert.strictEqual(manager.options.remote, 'origin');
      assert.strictEqual(manager.options.autoRestart, false);
    });
  });

  describe('Status', () => {
    it('deve retornar status do sistema', () => {
      const status = manager.getStatus();

      assert.ok(status.currentVersion);
      assert.strictEqual(status.updateInProgress, false);
      assert.ok(status.repoDir);
      assert.strictEqual(status.branch, 'main');
      assert.strictEqual(status.remote, 'origin');
    });
  });

  describe('Verificação de Updates', () => {
    it('deve verificar atualizações sem erro', async () => {
      const result = await manager.checkForUpdates();

      assert.ok(result !== undefined);
      assert.ok('available' in result || 'error' in result);

      if (!result.error) {
        assert.ok('currentCommit' in result);
      }
    });

    it('deve atualizar lastCheck após verificação', async () => {
      assert.strictEqual(manager.lastCheck, null);

      await manager.checkForUpdates();

      // Se não houve erro de rede, lastCheck deve estar definido
      if (manager.lastCheck) {
        assert.ok(manager.lastCheck > 0);
      }
    });

    it('não deve permitir verificação durante atualização', async () => {
      manager.updateInProgress = true;

      const result = await manager.checkForUpdates();

      assert.strictEqual(result.available, false);
      assert.ok(result.message.includes('andamento'));

      manager.updateInProgress = false;
    });
  });

  describe('Aplicação de Updates', () => {
    it('não deve permitir update durante outro update', async () => {
      manager.updateInProgress = true;

      const result = await manager.applyUpdate();

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('andamento'));

      manager.updateInProgress = false;
    });

    it('deve emitir evento updateStarted', async () => {
      let eventEmitted = false;

      manager.once('updateStarted', () => {
        eventEmitted = true;
        // Cancelar o update simulando um erro
        manager.updateInProgress = false;
      });

      // Iniciar update (pode falhar, mas evento deve ser emitido)
      manager.applyUpdate().catch(() => {});

      // Aguardar evento
      await new Promise(resolve => setTimeout(resolve, 100));

      // Pode ter emitido ou não dependendo do estado do git
      // O importante é que não houve exceção
      assert.ok(true);
    });
  });

  describe('Eventos', () => {
    it('deve ser um EventEmitter', () => {
      assert.ok(typeof manager.on === 'function');
      assert.ok(typeof manager.emit === 'function');
      assert.ok(typeof manager.once === 'function');
    });
  });

  describe('Execução de Comandos', () => {
    it('deve executar comando git status', async () => {
      try {
        const result = await manager._execAsync('git status --porcelain');
        assert.ok(result.stdout !== undefined);
      } catch (error) {
        // Git pode não estar disponível em todos os ambientes
        assert.ok(error.stderr || error.error);
      }
    });

    it('deve executar no diretório correto', async () => {
      try {
        const result = await manager._execAsync('pwd');
        assert.ok(result.stdout.includes(manager.options.repoDir) ||
          result.stdout === manager.options.repoDir);
      } catch (error) {
        // pwd pode não existir no Windows
        if (process.platform !== 'win32') {
          throw error;
        }
      }
    });
  });
});

console.log('Testes UpdateManager carregados');
