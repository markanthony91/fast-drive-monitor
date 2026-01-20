/**
 * API Server - Fast Drive
 *
 * Servidor Express com API REST para gerenciamento de headsets
 * e WebSocket para atualizações em tempo real.
 */

const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const { HeadsetManager, HEADSET_COLORS } = require('../headsetManager');
const { JabraService } = require('../jabraService');
const { BatteryTracker } = require('../batteryTracker');
const { UpdateManager } = require('../updateManager');
const { EventLogger, EVENT_TYPES } = require('../eventLogger');
const packageJson = require('../../package.json');

/**
 * Obtém o IP local da máquina (primeira interface não-loopback)
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar loopback e IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

class ApiServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 18080,
      host: options.host || 'localhost',
      dataDir: options.dataDir || path.join(process.cwd(), 'data'),
      ...options
    };

    // Identificação do servidor
    this.serverInfo = {
      hostname: os.hostname(),
      ip: getLocalIP(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      version: packageJson.version,
      startedAt: Date.now()
    };

    this.app = express();
    this.server = null;
    this.wss = null;

    // Serviços
    this.headsetManager = new HeadsetManager({
      dataDir: this.options.dataDir,
      hostname: this.serverInfo.hostname
    });
    this.jabraService = new JabraService();
    this.batteryTracker = new BatteryTracker({
      dataDir: this.options.dataDir,
      hostname: this.serverInfo.hostname
    });
    this.updateManager = new UpdateManager({
      autoRestart: false // Não reiniciar automaticamente
    });
    this.eventLogger = new EventLogger({
      dataDir: this.options.dataDir,
      hostname: this.serverInfo.hostname
    });

    // WebSocket clients
    this.wsClients = new Set();

    // Track call start times for duration calculation
    this._callStartTimes = new Map();
  }

  /**
   * Inicializa o servidor
   */
  async initialize() {
    // Configurar Express
    this._setupExpress();

    // Inicializar serviços
    await this.headsetManager.initialize();
    await this.batteryTracker.initialize();
    await this.updateManager.initialize();
    await this.eventLogger.initialize();

    // Configurar eventos
    this._setupEvents();

    // Inicializar Jabra SDK
    await this.jabraService.initialize();

    // Criar servidor HTTP
    this.server = createServer(this.app);

    // Configurar WebSocket
    this._setupWebSocket();

    // Iniciar servidor
    return new Promise((resolve) => {
      this.server.listen(this.options.port, this.options.host, () => {
        console.log(`[ApiServer] Servidor rodando em http://${this.options.host}:${this.options.port}`);
        resolve(true);
      });
    });
  }

  /**
   * Configura Express
   */
  _setupExpress() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../public')));

    // CORS para desenvolvimento
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Rotas da API
    this._setupRoutes();
  }

  /**
   * Configura rotas da API
   */
  _setupRoutes() {
    const router = express.Router();

    // === Informações do Servidor ===
    router.get('/server-info', (req, res) => {
      res.json({
        ...this.serverInfo,
        uptime: Date.now() - this.serverInfo.startedAt
      });
    });

    // === Estado do Sistema ===
    router.get('/state', (req, res) => {
      res.json({
        hostname: this.serverInfo.hostname,
        ...this.headsetManager.getSystemState()
      });
    });

    // === Headsets ===

    // Listar todos os headsets registrados
    router.get('/headsets', (req, res) => {
      res.json(this.headsetManager.getRegisteredHeadsets());
    });

    // Obter headset específico
    router.get('/headsets/:id', (req, res) => {
      const headset = this.headsetManager.getHeadset(req.params.id);
      if (!headset) {
        return res.status(404).json({ error: 'Headset não encontrado' });
      }
      res.json(headset);
    });

    // Registrar novo headset
    router.post('/headsets', (req, res) => {
      try {
        const headset = this.headsetManager.registerHeadset(req.body);
        res.status(201).json(headset);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Atualizar headset
    router.put('/headsets/:id', (req, res) => {
      try {
        const headset = this.headsetManager.updateHeadset(req.params.id, req.body);
        res.json(headset);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Remover headset
    router.delete('/headsets/:id', (req, res) => {
      try {
        this.headsetManager.removeHeadset(req.params.id);
        res.status(204).send();
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // === Headsets Ativos ===

    router.get('/headsets/active', (req, res) => {
      res.json(this.headsetManager.getActiveHeadsets());
    });

    // === Dongles ===

    router.get('/dongles', (req, res) => {
      res.json(this.headsetManager.getConnectedDongles());
    });

    // === Cores ===

    router.get('/colors', (req, res) => {
      res.json(HEADSET_COLORS);
    });

    // === Estatísticas ===

    router.get('/stats', (req, res) => {
      res.json({
        hostname: this.serverInfo.hostname,
        ...this.batteryTracker.getStatistics()
      });
    });

    router.get('/stats/battery-history', (req, res) => {
      const hours = parseInt(req.query.hours) || 24;
      res.json({
        hostname: this.serverInfo.hostname,
        data: this.batteryTracker.getBatteryHistory(hours)
      });
    });

    router.get('/stats/charging-history', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      res.json({
        hostname: this.serverInfo.hostname,
        data: this.batteryTracker.getChargingHistory(limit)
      });
    });

    // === Sistema de Atualizações ===

    // Status do sistema de updates
    router.get('/update/status', (req, res) => {
      res.json({
        hostname: this.serverInfo.hostname,
        ...this.updateManager.getStatus()
      });
    });

    // Verificar se há atualizações
    router.get('/update/check', async (req, res) => {
      const result = await this.updateManager.checkForUpdates();
      res.json({
        hostname: this.serverInfo.hostname,
        ...result
      });
    });

    // Aplicar atualizações
    router.post('/update/apply', async (req, res) => {
      const result = await this.updateManager.applyUpdate();
      res.json({
        hostname: this.serverInfo.hostname,
        ...result
      });
    });

    // Reiniciar serviço
    router.post('/update/restart', (req, res) => {
      res.json({
        hostname: this.serverInfo.hostname,
        success: true,
        message: 'Reiniciando em 3 segundos...'
      });

      setTimeout(() => {
        this.updateManager.restartService();
      }, 3000);
    });

    // === Sistema de Logs ===

    // Buscar logs com filtros
    router.get('/logs', (req, res) => {
      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0,
        eventType: req.query.type || null,
        severity: req.query.severity || null,
        headsetId: req.query.headsetId || null,
        dongleId: req.query.dongleId || null,
        startTime: req.query.startTime ? parseInt(req.query.startTime) : null,
        endTime: req.query.endTime ? parseInt(req.query.endTime) : null
      };

      res.json({
        hostname: this.serverInfo.hostname,
        data: this.eventLogger.getLogs(options)
      });
    });

    // Estatísticas de logs
    router.get('/logs/stats', (req, res) => {
      const hours = parseInt(req.query.hours) || 24;
      res.json({
        hostname: this.serverInfo.hostname,
        data: this.eventLogger.getLogStats(hours)
      });
    });

    // Histórico de conexões de dongle
    router.get('/logs/dongles', (req, res) => {
      const dongleId = req.query.dongleId || null;
      const limit = parseInt(req.query.limit) || 100;
      res.json({
        hostname: this.serverInfo.hostname,
        data: this.eventLogger.getDongleHistory(dongleId, limit)
      });
    });

    // Sessões de headset
    router.get('/logs/sessions', (req, res) => {
      const headsetId = req.query.headsetId || null;
      const limit = parseInt(req.query.limit) || 50;
      res.json({
        hostname: this.serverInfo.hostname,
        data: this.eventLogger.getHeadsetSessions(headsetId, limit)
      });
    });

    // Tipos de eventos disponíveis
    router.get('/logs/types', (req, res) => {
      res.json({
        hostname: this.serverInfo.hostname,
        data: EVENT_TYPES
      });
    });

    // Montar rotas
    this.app.use('/api', router);

    // Servir frontend
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../public/index.html'));
    });
  }

  /**
   * Configura WebSocket
   */
  _setupWebSocket() {
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      console.log('[ApiServer] WebSocket: Cliente conectado');
      this.wsClients.add(ws);

      // Enviar estado inicial
      ws.send(JSON.stringify({
        type: 'init',
        data: this.headsetManager.getSystemState(),
        hostname: this.serverInfo.hostname,
        serverInfo: this.serverInfo,
        timestamp: Date.now()
      }));

      ws.on('close', () => {
        console.log('[ApiServer] WebSocket: Cliente desconectado');
        this.wsClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[ApiServer] WebSocket error:', error);
        this.wsClients.delete(ws);
      });
    });
  }

  /**
   * Broadcast para todos os clientes WebSocket
   */
  _broadcast(type, data) {
    const message = JSON.stringify({
      type,
      data,
      hostname: this.serverInfo.hostname,
      timestamp: Date.now()
    });

    this.wsClients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  /**
   * Configura eventos dos serviços
   */
  _setupEvents() {
    // Eventos do HeadsetManager
    this.headsetManager.on('headsetRegistered', (headset) => {
      this._broadcast('headsetRegistered', headset);
      this.eventLogger.log(EVENT_TYPES.HEADSET_REGISTERED, {
        headsetId: headset.id,
        message: `Headset registrado: ${headset.name}`,
        details: headset
      });
    });

    this.headsetManager.on('headsetUpdated', (headset) => {
      this._broadcast('headsetUpdated', headset);
      this.eventLogger.log(EVENT_TYPES.HEADSET_UPDATED, {
        headsetId: headset.id,
        message: `Headset atualizado: ${headset.name}`,
        details: headset
      });
    });

    this.headsetManager.on('headsetRemoved', (data) => {
      this._broadcast('headsetRemoved', data);
      this.eventLogger.log(EVENT_TYPES.HEADSET_REMOVED, {
        headsetId: data.id,
        message: `Headset removido: ${data.name || data.id}`
      });
    });

    this.headsetManager.on('dongleConnected', (dongle) => {
      this._broadcast('dongleConnected', dongle);
      this.eventLogger.logDongleConnected(dongle.id, dongle.name, {
        productId: dongle.productId
      });
    });

    this.headsetManager.on('dongleDisconnected', (data) => {
      this._broadcast('dongleDisconnected', data);
      this.eventLogger.logDongleDisconnected(
        data.id,
        data.dongle?.name || 'Unknown',
        data.reason || 'unknown'
      );
    });

    this.headsetManager.on('headsetTurnedOn', (headset) => {
      // Enriquecer com estimativas de tempo do BatteryTracker
      const enrichedHeadset = {
        ...headset,
        estimatedTimeToFull: headset.isCharging
          ? this.batteryTracker.estimateTimeToFullCharge(headset.batteryLevel)
          : null,
        estimatedTimeToEmpty: !headset.isCharging
          ? this.batteryTracker.estimateBatteryLife(headset.batteryLevel, headset.isInCall)
          : null
      };
      this._broadcast('headsetTurnedOn', enrichedHeadset);
      this.eventLogger.logHeadsetTurnedOn(
        headset.id,
        headset.name,
        headset.batteryLevel,
        { serialNumber: headset.serialNumber }
      );
    });

    this.headsetManager.on('headsetTurnedOff', (data) => {
      this._broadcast('headsetTurnedOff', data);
      this.eventLogger.logHeadsetTurnedOff(
        data.id,
        data.name || 'Unknown',
        data.lastBatteryLevel,
        data.reason || 'normal'
      );
    });

    this.headsetManager.on('headsetStateUpdated', (headset) => {
      // Enriquecer com estimativas de tempo do BatteryTracker
      const enrichedHeadset = {
        ...headset,
        estimatedTimeToFull: headset.isCharging
          ? this.batteryTracker.estimateTimeToFullCharge(headset.batteryLevel)
          : null,
        estimatedTimeToEmpty: !headset.isCharging
          ? this.batteryTracker.estimateBatteryLife(headset.batteryLevel, headset.isInCall)
          : null
      };
      this._broadcast('headsetStateUpdated', enrichedHeadset);
    });

    // Eventos do JabraService
    this.jabraService.on('deviceDetected', (data) => {
      console.log('[ApiServer] Dispositivo detectado:', data.name);

      // Detectar dongle: "Jabra Link 400", "Jabra Dongle", etc.
      const nameLower = data.name?.toLowerCase() || '';
      const isDongle = nameLower.includes('dongle') || nameLower.includes('link');

      if (isDongle) {
        this.headsetManager.dongleConnected({
          id: data.productId?.toString() || `dongle_${Date.now()}`,
          name: data.name,
          productId: data.productId
        });
      }
    });

    this.jabraService.on('deviceRemoved', (data) => {
      console.log('[ApiServer] Dispositivo removido:', data.name);

      // Verificar se é um dongle sendo removido fisicamente
      const nameLower = data.name?.toLowerCase() || '';
      const isDongle = nameLower.includes('dongle') || nameLower.includes('link');

      if (isDongle) {
        const dongleId = data.productId?.toString() || 'unknown';
        this.headsetManager.dongleDisconnected(dongleId);
        this.eventLogger.logDongleDisconnected(dongleId, data.name, 'usb_removed', {
          reason: 'Dongle USB removido fisicamente'
        });
      }
    });

    this.jabraService.on('connected', (data) => {
      console.log('[ApiServer] Headset conectado:', data.device, '- SN:', data.serialNumber);

      // Usar serialNumber como ID para persistência correta
      const headsetId = data.serialNumber || `hs_${Date.now()}`;
      this.headsetManager.headsetTurnedOn(headsetId, {
        name: data.device,
        serialNumber: data.serialNumber,
        firmwareVersion: data.state?.firmwareVersion,
        batteryLevel: data.state?.batteryLevel,
        isCharging: data.state?.isCharging,
        isInCall: data.state?.isInCall,
        isMuted: data.state?.isMuted
      });

      // Atualizar tracker de bateria
      if (data.state?.batteryLevel !== null) {
        this.batteryTracker.updateBatteryLevel(
          data.state.batteryLevel,
          data.state.isCharging
        );
      }
    });

    this.jabraService.on('disconnected', (data) => {
      console.log('[ApiServer] Headset desconectado');
      // Encontrar e desligar headset
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.headsetManager.headsetTurnedOff(h.id, 'connection_lost');
        this.eventLogger.logHeadsetTurnedOff(
          h.id,
          h.name,
          h.batteryLevel,
          'connection_lost',
          { lastState: data.lastState }
        );
      });
    });

    this.jabraService.on('batteryChange', (data) => {
      this.batteryTracker.updateBatteryLevel(data.current, data.isCharging);

      // Atualizar estado do headset ativo
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.headsetManager.updateHeadsetState(h.id, {
          batteryLevel: data.current,
          isCharging: data.isCharging
        });

        // Log de bateria baixa/crítica
        if (data.current < 10 && !data.isCharging) {
          this.eventLogger.logBatteryCritical(h.id, h.name, data.current);
        } else if (data.current < 20 && !data.isCharging) {
          this.eventLogger.logBatteryLow(h.id, h.name, data.current);
        }
      });
    });

    this.jabraService.on('chargingStarted', (data) => {
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.eventLogger.logChargingStarted(h.id, h.name, data.batteryLevel);
      });
    });

    this.jabraService.on('chargingStopped', (data) => {
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.eventLogger.logChargingStopped(h.id, h.name, data.batteryLevel);
      });
    });

    this.jabraService.on('callStateChange', (data) => {
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.headsetManager.updateHeadsetState(h.id, {
          isInCall: data.isInCall
        });

        // Log e tracking de chamadas
        if (data.isInCall) {
          this._callStartTimes.set(h.id, Date.now());
          this.eventLogger.logCallStarted(h.id, h.name);
        } else {
          const startTime = this._callStartTimes.get(h.id);
          if (startTime) {
            const durationSeconds = (Date.now() - startTime) / 1000;
            this.eventLogger.logCallEnded(h.id, h.name, durationSeconds);
            this._callStartTimes.delete(h.id);
          }
        }
      });
      this.batteryTracker.updateCallState(data.isInCall);
    });

    this.jabraService.on('muteChange', (data) => {
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.headsetManager.updateHeadsetState(h.id, {
          isMuted: data.isMuted
        });
        this.eventLogger.log(EVENT_TYPES.MUTE_CHANGED, {
          headsetId: h.id,
          message: `Mute ${data.isMuted ? 'ativado' : 'desativado'}: ${h.name}`,
          details: { isMuted: data.isMuted }
        });
      });
      this.batteryTracker.updateMuteState(data.isMuted);
    });

    // Eventos de erro do JabraService
    this.jabraService.on('error', (data) => {
      this.eventLogger.logError('JabraService', data.error, data);
    });
  }

  /**
   * Para o servidor
   */
  async shutdown() {
    console.log('[ApiServer] Finalizando...');

    // Fechar WebSocket
    if (this.wss) {
      this.wss.close();
    }

    // Fechar servidor HTTP
    if (this.server) {
      this.server.close();
    }

    // Finalizar serviços
    await this.jabraService.disconnect();
    await this.batteryTracker.shutdown();
    await this.headsetManager.shutdown();
    await this.eventLogger.shutdown();

    console.log('[ApiServer] Finalizado');
  }
}

module.exports = { ApiServer };

// Execução direta
if (require.main === module) {
  const server = new ApiServer();

  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });

  server.initialize().catch(error => {
    console.error('[ApiServer] Erro fatal:', error);
    process.exit(1);
  });
}
