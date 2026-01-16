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
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
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

    // WebSocket clients
    this.wsClients = new Set();
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
    });

    this.headsetManager.on('headsetUpdated', (headset) => {
      this._broadcast('headsetUpdated', headset);
    });

    this.headsetManager.on('headsetRemoved', (data) => {
      this._broadcast('headsetRemoved', data);
    });

    this.headsetManager.on('dongleConnected', (dongle) => {
      this._broadcast('dongleConnected', dongle);
    });

    this.headsetManager.on('dongleDisconnected', (data) => {
      this._broadcast('dongleDisconnected', data);
    });

    this.headsetManager.on('headsetTurnedOn', (headset) => {
      this._broadcast('headsetTurnedOn', headset);
    });

    this.headsetManager.on('headsetTurnedOff', (data) => {
      this._broadcast('headsetTurnedOff', data);
    });

    this.headsetManager.on('headsetStateUpdated', (headset) => {
      this._broadcast('headsetStateUpdated', headset);
    });

    // Eventos do JabraService
    this.jabraService.on('deviceDetected', (data) => {
      console.log('[ApiServer] Dispositivo detectado:', data.name);

      if (data.name && data.name.toLowerCase().includes('dongle')) {
        this.headsetManager.dongleConnected({
          id: data.productId?.toString() || `dongle_${Date.now()}`,
          name: data.name
        });
      }
    });

    this.jabraService.on('connected', (data) => {
      console.log('[ApiServer] Headset conectado:', data.device);

      const headsetId = data.state?.serialNumber || `hs_${Date.now()}`;
      this.headsetManager.headsetTurnedOn(headsetId, {
        name: data.device,
        serialNumber: data.state?.serialNumber,
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
        this.headsetManager.headsetTurnedOff(h.id);
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
      });
    });

    this.jabraService.on('callStateChange', (data) => {
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.headsetManager.updateHeadsetState(h.id, {
          isInCall: data.isInCall
        });
      });
      this.batteryTracker.updateCallState(data.isInCall);
    });

    this.jabraService.on('muteChange', (data) => {
      const activeHeadsets = this.headsetManager.getActiveHeadsets();
      activeHeadsets.forEach(h => {
        this.headsetManager.updateHeadsetState(h.id, {
          isMuted: data.isMuted
        });
      });
      this.batteryTracker.updateMuteState(data.isMuted);
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
