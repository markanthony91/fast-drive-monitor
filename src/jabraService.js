/**
 * JabraService - Serviço para conexão e monitoramento do headset Jabra Engage 55 Mono
 *
 * Este módulo gerencia a comunicação com o headset via SDK da Jabra,
 * fornecendo eventos para mudanças de estado e informações do dispositivo.
 */

const { createApi } = require('@gnaudio/jabra-js');
const { createProperties } = require('@gnaudio/jabra-js-properties');
const { EventEmitter } = require('events');

// Constantes do dispositivo
const JABRA_ENGAGE_55_MONO = {
  productId: 0x0A72, // Product ID do Engage 55 Mono (verificar na documentação)
  vendorId: 0x0B0E,  // Vendor ID da Jabra/GN Audio
  name: 'Jabra Engage 55 Mono'
};

// Propriedades que queremos monitorar
const MONITORED_PROPERTIES = [
  'batteryLevel',
  'batteryCharging',
  'firmwareVersion',
  'deviceName',
  'serialNumber',
  'connectionStatus',
  'muteState',
  'callState',
  'hookState'
];

class JabraService extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      partnerKey: config.partnerKey || process.env.JABRA_PARTNER_KEY || '',
      appId: config.appId || 'fast-drive-jabra-monitor',
      appName: config.appName || 'Fast Drive - Jabra Monitor'
    };

    this.sdk = null;
    this.device = null;
    this.properties = null;
    this.callControl = null;
    this.isConnected = false;
    this.deviceState = {
      batteryLevel: null,
      isCharging: false,
      isPowerOn: false,
      isInCall: false,
      isMuted: false,
      isOnDock: false,
      firmwareVersion: null,
      serialNumber: null
    };

    this._subscriptions = [];
  }

  /**
   * Inicializa o SDK da Jabra e começa a detectar dispositivos
   */
  async initialize() {
    try {
      console.log('[JabraService] Inicializando SDK...');

      this.sdk = await createApi({
        partnerKey: this.config.partnerKey,
        appId: this.config.appId,
        appName: this.config.appName,
        transport: 'node' // Usar transporte Node.js
      });

      // Configurar listeners de eventos do SDK
      this._setupSdkListeners();

      // Iniciar descoberta de dispositivos
      await this.sdk.start();

      console.log('[JabraService] SDK inicializado com sucesso');
      this.emit('sdkReady');

      return true;
    } catch (error) {
      console.error('[JabraService] Erro ao inicializar SDK:', error);
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  /**
   * Configura listeners para eventos do SDK
   */
  _setupSdkListeners() {
    // Dispositivo conectado
    const deviceAddedSub = this.sdk.deviceAdded.subscribe(device => {
      console.log(`[JabraService] Dispositivo detectado: ${device.name}`);

      // Verificar se é o Engage 55 Mono
      if (this._isEngage55Mono(device)) {
        this._connectToDevice(device);
      }

      this.emit('deviceDetected', {
        name: device.name,
        productId: device.productId,
        isEngage55: this._isEngage55Mono(device)
      });
    });
    this._subscriptions.push(deviceAddedSub);

    // Dispositivo desconectado
    const deviceRemovedSub = this.sdk.deviceRemoved.subscribe(device => {
      console.log(`[JabraService] Dispositivo removido: ${device.name}`);

      if (this.device && device.deviceId === this.device.deviceId) {
        this._handleDeviceDisconnect();
      }

      this.emit('deviceRemoved', { name: device.name });
    });
    this._subscriptions.push(deviceRemovedSub);
  }

  /**
   * Verifica se o dispositivo é um Jabra Engage 55 Mono
   */
  _isEngage55Mono(device) {
    // Verificar pelo nome ou product ID
    const nameMatch = device.name &&
      device.name.toLowerCase().includes('engage') &&
      device.name.toLowerCase().includes('55');

    return nameMatch || device.productId === JABRA_ENGAGE_55_MONO.productId;
  }

  /**
   * Conecta ao dispositivo e configura monitoramento
   */
  async _connectToDevice(device) {
    try {
      console.log(`[JabraService] Conectando ao ${device.name}...`);

      this.device = device;
      this.isConnected = true;

      // Criar controle de chamadas
      await this._setupCallControl(device);

      // Configurar propriedades para telemetria
      await this._setupProperties(device);

      // Atualizar estado inicial
      await this._updateInitialState();

      this.deviceState.isPowerOn = true;

      console.log(`[JabraService] Conectado ao ${device.name}`);
      this.emit('connected', {
        device: device.name,
        state: this.deviceState
      });

    } catch (error) {
      console.error('[JabraService] Erro ao conectar:', error);
      this.emit('error', { type: 'connection', error });
    }
  }

  /**
   * Configura controle de chamadas
   */
  async _setupCallControl(device) {
    try {
      const { createMultiCallControl } = require('@gnaudio/jabra-js');
      this.callControl = await createMultiCallControl(device);

      // Monitorar mudanças de estado de chamada
      const callStateSub = this.callControl.callStateChange.subscribe(state => {
        this._handleCallStateChange(state);
      });
      this._subscriptions.push(callStateSub);

      // Monitorar mudanças de mute
      const muteSub = this.callControl.muteState.subscribe(muteState => {
        this._handleMuteChange(muteState);
      });
      this._subscriptions.push(muteSub);

    } catch (error) {
      console.warn('[JabraService] Call control não disponível:', error.message);
    }
  }

  /**
   * Configura módulo de propriedades para telemetria
   */
  async _setupProperties(device) {
    try {
      this.properties = await createProperties(device, MONITORED_PROPERTIES);

      // Monitorar nível de bateria
      const batteryProp = this.properties.get('batteryLevel');
      if (batteryProp) {
        const batterySub = batteryProp.valueChange.subscribe(value => {
          this._handleBatteryChange(value);
        });
        this._subscriptions.push(batterySub);
      }

      // Monitorar estado de carregamento
      const chargingProp = this.properties.get('batteryCharging');
      if (chargingProp) {
        const chargingSub = chargingProp.valueChange.subscribe(value => {
          this._handleChargingChange(value);
        });
        this._subscriptions.push(chargingSub);
      }

    } catch (error) {
      console.warn('[JabraService] Propriedades não disponíveis:', error.message);
    }
  }

  /**
   * Atualiza estado inicial do dispositivo
   */
  async _updateInitialState() {
    if (!this.properties) return;

    try {
      // Ler valores iniciais
      const batteryProp = this.properties.get('batteryLevel');
      if (batteryProp) {
        this.deviceState.batteryLevel = await batteryProp.get();
      }

      const chargingProp = this.properties.get('batteryCharging');
      if (chargingProp) {
        this.deviceState.isCharging = await chargingProp.get();
      }

      const fwProp = this.properties.get('firmwareVersion');
      if (fwProp) {
        this.deviceState.firmwareVersion = await fwProp.get();
      }

      const serialProp = this.properties.get('serialNumber');
      if (serialProp) {
        this.deviceState.serialNumber = await serialProp.get();
      }

    } catch (error) {
      console.warn('[JabraService] Erro ao ler estado inicial:', error.message);
    }
  }

  /**
   * Handlers para mudanças de estado
   */
  _handleBatteryChange(batteryLevel) {
    const previousLevel = this.deviceState.batteryLevel;
    this.deviceState.batteryLevel = batteryLevel;

    console.log(`[JabraService] Bateria: ${batteryLevel}%`);

    this.emit('batteryChange', {
      current: batteryLevel,
      previous: previousLevel,
      isCharging: this.deviceState.isCharging
    });
  }

  _handleChargingChange(isCharging) {
    const wasCharging = this.deviceState.isCharging;
    this.deviceState.isCharging = isCharging;
    this.deviceState.isOnDock = isCharging;

    console.log(`[JabraService] Carregando: ${isCharging}`);

    if (isCharging && !wasCharging) {
      this.emit('chargingStarted', {
        batteryLevel: this.deviceState.batteryLevel,
        timestamp: Date.now()
      });
    } else if (!isCharging && wasCharging) {
      this.emit('chargingStopped', {
        batteryLevel: this.deviceState.batteryLevel,
        timestamp: Date.now()
      });
    }

    this.emit('chargingChange', {
      isCharging,
      wasCharging,
      batteryLevel: this.deviceState.batteryLevel
    });
  }

  _handleCallStateChange(state) {
    this.deviceState.isInCall = state.inCall || false;

    console.log(`[JabraService] Em chamada: ${this.deviceState.isInCall}`);

    this.emit('callStateChange', {
      isInCall: this.deviceState.isInCall,
      state
    });
  }

  _handleMuteChange(muteState) {
    this.deviceState.isMuted = muteState.muted || false;

    console.log(`[JabraService] Mudo: ${this.deviceState.isMuted}`);

    this.emit('muteChange', {
      isMuted: this.deviceState.isMuted
    });
  }

  _handleDeviceDisconnect() {
    console.log('[JabraService] Dispositivo desconectado');

    this.isConnected = false;
    this.deviceState.isPowerOn = false;

    this.emit('disconnected', {
      lastState: { ...this.deviceState }
    });

    // Limpar referências
    this.device = null;
    this.properties = null;
    this.callControl = null;
  }

  /**
   * Obtém estado atual do dispositivo
   */
  getState() {
    return {
      isConnected: this.isConnected,
      ...this.deviceState
    };
  }

  /**
   * Obtém nível de bateria atual
   */
  getBatteryLevel() {
    return this.deviceState.batteryLevel;
  }

  /**
   * Verifica se está carregando
   */
  isCharging() {
    return this.deviceState.isCharging;
  }

  /**
   * Verifica se está em chamada
   */
  isInCall() {
    return this.deviceState.isInCall;
  }

  /**
   * Verifica se está mutado
   */
  isMuted() {
    return this.deviceState.isMuted;
  }

  /**
   * Lista todos os dispositivos Jabra conectados
   */
  async listDevices() {
    if (!this.sdk) {
      throw new Error('SDK não inicializado');
    }

    return new Promise((resolve) => {
      const devices = [];
      const sub = this.sdk.deviceList.subscribe(deviceList => {
        deviceList.forEach(device => {
          devices.push({
            name: device.name,
            productId: device.productId,
            deviceId: device.deviceId,
            isEngage55: this._isEngage55Mono(device)
          });
        });
        sub.unsubscribe();
        resolve(devices);
      });
    });
  }

  /**
   * Desconecta e libera recursos
   */
  async disconnect() {
    console.log('[JabraService] Desconectando...');

    // Cancelar todas as subscriptions
    this._subscriptions.forEach(sub => {
      if (sub && sub.unsubscribe) {
        sub.unsubscribe();
      }
    });
    this._subscriptions = [];

    // Parar SDK
    if (this.sdk) {
      await this.sdk.stop();
    }

    this._handleDeviceDisconnect();

    console.log('[JabraService] Desconectado');
    this.emit('shutdown');
  }
}

module.exports = { JabraService, JABRA_ENGAGE_55_MONO };
