/**
 * Fast Drive - Jabra Engage 55 Mono Headset Monitor
 *
 * Aplicação principal que monitora o headset Jabra Engage 55 Mono
 * e fornece informações sobre bateria, status e estatísticas de uso.
 */

const { JabraService } = require('./jabraService');
const { BatteryTracker } = require('./batteryTracker');
const { EventEmitter } = require('events');

class FastDriveApp extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      partnerKey: config.partnerKey || process.env.JABRA_PARTNER_KEY || '',
      dataDir: config.dataDir || './data',
      pollInterval: config.pollInterval || 30000, // 30 segundos
      ...config
    };

    this.jabraService = new JabraService({
      partnerKey: this.config.partnerKey
    });

    this.batteryTracker = new BatteryTracker({
      dataDir: this.config.dataDir
    });

    this.isRunning = false;
    this._pollIntervalId = null;
  }

  /**
   * Inicializa a aplicação
   */
  async start() {
    console.log('');
    console.log('==========================================');
    console.log('  Fast Drive - Jabra Headset Monitor');
    console.log('==========================================');
    console.log('');

    try {
      // Inicializar rastreador de bateria
      await this.batteryTracker.initialize();

      // Configurar listeners
      this._setupListeners();

      // Inicializar serviço Jabra
      await this.jabraService.initialize();

      this.isRunning = true;

      console.log('[FastDrive] Aplicação iniciada');
      console.log('[FastDrive] Aguardando conexão do headset...');
      console.log('');

      this.emit('started');

      return true;
    } catch (error) {
      console.error('[FastDrive] Erro ao iniciar:', error);
      this.emit('error', { type: 'startup', error });
      return false;
    }
  }

  /**
   * Configura listeners para eventos dos módulos
   */
  _setupListeners() {
    // Eventos do JabraService
    this.jabraService.on('connected', (data) => {
      console.log(`[FastDrive] Headset conectado: ${data.device}`);
      this._onDeviceConnected(data);
    });

    this.jabraService.on('disconnected', (data) => {
      console.log('[FastDrive] Headset desconectado');
      this.batteryTracker.updatePowerState(false);
      this.emit('deviceDisconnected', data);
    });

    this.jabraService.on('batteryChange', (data) => {
      this.batteryTracker.updateBatteryLevel(data.current, data.isCharging);
      this._displayBatteryStatus(data);
      this.emit('batteryChange', data);
    });

    this.jabraService.on('chargingStarted', (data) => {
      console.log('[FastDrive] Carregador conectado');
      this.emit('chargingStarted', data);
    });

    this.jabraService.on('chargingStopped', (data) => {
      console.log('[FastDrive] Carregador desconectado');
      this.emit('chargingStopped', data);
    });

    this.jabraService.on('callStateChange', (data) => {
      this.batteryTracker.updateCallState(data.isInCall);
      console.log(`[FastDrive] ${data.isInCall ? 'Em chamada' : 'Chamada finalizada'}`);
      this.emit('callStateChange', data);
    });

    this.jabraService.on('muteChange', (data) => {
      this.batteryTracker.updateMuteState(data.isMuted);
      console.log(`[FastDrive] ${data.isMuted ? 'Microfone mutado' : 'Microfone ativo'}`);
      this.emit('muteChange', data);
    });

    // Eventos do BatteryTracker
    this.batteryTracker.on('chargingStarted', (data) => {
      this._displayChargingEstimate(data);
    });

    this.batteryTracker.on('chargingEnded', (data) => {
      this._displayChargingComplete(data);
    });

    this.batteryTracker.on('usageStarted', (data) => {
      this._displayUsageEstimate(data);
    });
  }

  /**
   * Chamado quando dispositivo é conectado
   */
  _onDeviceConnected(data) {
    this.batteryTracker.updatePowerState(true);

    if (data.state.batteryLevel !== null) {
      this.batteryTracker.updateBatteryLevel(
        data.state.batteryLevel,
        data.state.isCharging
      );
    }

    this.emit('deviceConnected', data);
  }

  /**
   * Exibe status da bateria no console
   */
  _displayBatteryStatus(data) {
    const bar = this._createProgressBar(data.current, 20);
    const status = data.isCharging ? ' [Carregando]' : '';

    console.log('');
    console.log('------------------------------------------');
    console.log(`  Bateria: ${bar} ${data.current}%${status}`);
    console.log('------------------------------------------');
  }

  /**
   * Exibe estimativa de carregamento
   */
  _displayChargingEstimate(data) {
    const timeMinutes = data.estimatedTimeToFull;
    const timeFormatted = this._formatTime(timeMinutes);

    console.log('');
    console.log('==========================================');
    console.log('  CARREGAMENTO INICIADO');
    console.log('==========================================');
    console.log(`  Nível atual: ${data.startLevel}%`);
    console.log(`  Tempo estimado para 100%: ${timeFormatted}`);
    console.log('==========================================');
    console.log('');
  }

  /**
   * Exibe resumo de carregamento completo
   */
  _displayChargingComplete(data) {
    const timeFormatted = this._formatTime(data.durationMinutes);

    console.log('');
    console.log('==========================================');
    console.log('  CARREGAMENTO FINALIZADO');
    console.log('==========================================');
    console.log(`  De ${data.startLevel}% para ${data.endLevel}%`);
    console.log(`  Duração: ${timeFormatted}`);
    console.log(`  Taxa: ${data.chargingRate.toFixed(2)}% por minuto`);
    if (data.completed) {
      console.log('  Status: Carga completa!');
    }
    console.log('==========================================');
    console.log('');
  }

  /**
   * Exibe estimativa de uso
   */
  _displayUsageEstimate(data) {
    const timeFormatted = this._formatTime(data.estimatedBatteryLife);

    console.log('');
    console.log('------------------------------------------');
    console.log(`  Bateria disponível: ${data.startLevel}%`);
    console.log(`  Autonomia estimada: ${timeFormatted}`);
    console.log('------------------------------------------');
    console.log('');
  }

  /**
   * Cria barra de progresso ASCII
   */
  _createProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '[' + '='.repeat(filled) + ' '.repeat(empty) + ']';
  }

  /**
   * Formata tempo em minutos para string legível
   */
  _formatTime(minutes) {
    if (minutes === null || minutes === undefined) {
      return 'N/A';
    }

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }

  /**
   * Obtém estado atual completo
   */
  getStatus() {
    const deviceState = this.jabraService.getState();
    const estimates = this.batteryTracker.calculateEstimates();
    const stats = this.batteryTracker.getStatistics();

    return {
      device: deviceState,
      estimates,
      statistics: stats,
      isRunning: this.isRunning
    };
  }

  /**
   * Obtém histórico de bateria
   */
  getBatteryHistory(hours = 24) {
    return this.batteryTracker.getBatteryHistory(hours);
  }

  /**
   * Obtém histórico de carregamentos
   */
  getChargingHistory(limit = 50) {
    return this.batteryTracker.getChargingHistory(limit);
  }

  /**
   * Obtém histórico de uso
   */
  getUsageHistory(limit = 50) {
    return this.batteryTracker.getUsageHistory(limit);
  }

  /**
   * Obtém estatísticas completas
   */
  getStatistics() {
    return this.batteryTracker.getStatistics();
  }

  /**
   * Para a aplicação
   */
  async stop() {
    console.log('[FastDrive] Finalizando...');

    this.isRunning = false;

    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
    }

    await this.jabraService.disconnect();
    await this.batteryTracker.shutdown();

    console.log('[FastDrive] Aplicação finalizada');
    this.emit('stopped');
  }
}

// Exportar classe principal
module.exports = { FastDriveApp };

// Execução direta (modo CLI)
if (require.main === module) {
  const app = new FastDriveApp();

  // Tratamento de sinais para shutdown graceful
  process.on('SIGINT', async () => {
    console.log('\n[FastDrive] Recebido SIGINT, finalizando...');
    await app.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[FastDrive] Recebido SIGTERM, finalizando...');
    await app.stop();
    process.exit(0);
  });

  // Exibir status periodicamente
  setInterval(() => {
    if (app.isRunning) {
      const status = app.getStatus();
      if (status.device.isConnected) {
        const bar = app._createProgressBar(status.device.batteryLevel || 0, 20);
        const charging = status.device.isCharging ? ' [Carregando]' : '';
        const call = status.device.isInCall ? ' [Em chamada]' : '';
        const muted = status.device.isMuted ? ' [Mudo]' : '';

        process.stdout.write(`\r  ${bar} ${status.device.batteryLevel || 0}%${charging}${call}${muted}    `);
      }
    }
  }, 5000);

  // Iniciar aplicação
  app.start().catch(error => {
    console.error('[FastDrive] Erro fatal:', error);
    process.exit(1);
  });
}
