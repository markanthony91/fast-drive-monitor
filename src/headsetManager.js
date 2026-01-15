/**
 * HeadsetManager - Gerenciador de headsets com persistência
 *
 * Gerencia múltiplos headsets, suas configurações (cores, números)
 * e estados (conectado, ligado, em chamada, etc.)
 */

const { EventEmitter } = require('events');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Cores disponíveis para headsets
const HEADSET_COLORS = {
  blue: { name: 'Azul', hex: '#3B82F6', rgb: '59, 130, 246' },
  yellow: { name: 'Amarelo', hex: '#EAB308', rgb: '234, 179, 8' },
  green: { name: 'Verde', hex: '#22C55E', rgb: '34, 197, 94' },
  red: { name: 'Vermelho', hex: '#EF4444', rgb: '239, 68, 68' },
  white: { name: 'Branco', hex: '#F8FAFC', rgb: '248, 250, 252' }
};

class HeadsetManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), 'data'),
      hostname: options.hostname || os.hostname(),
      ...options
    };

    this.db = null;

    // Headsets registrados (configurações salvas)
    this.registeredHeadsets = new Map();

    // Headsets ativos (conectados e ligados)
    this.activeHeadsets = new Map();

    // Dongles conectados
    this.connectedDongles = new Map();
  }

  /**
   * Inicializa o gerenciador
   */
  async initialize() {
    try {
      if (!fs.existsSync(this.options.dataDir)) {
        fs.mkdirSync(this.options.dataDir, { recursive: true });
      }

      const dbPath = path.join(this.options.dataDir, 'headsets.db');
      this.db = new Database(dbPath);

      this._createTables();
      this._loadRegisteredHeadsets();

      console.log('[HeadsetManager] Inicializado com sucesso');
      this.emit('ready');

      return true;
    } catch (error) {
      console.error('[HeadsetManager] Erro na inicialização:', error);
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  /**
   * Cria tabelas no banco de dados
   */
  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS headsets (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL DEFAULT '',
        serial_number TEXT UNIQUE,
        name TEXT NOT NULL,
        model TEXT,
        color TEXT DEFAULT 'blue',
        number INTEGER,
        firmware_version TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dongles (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL DEFAULT '',
        headset_id TEXT,
        name TEXT,
        connected INTEGER DEFAULT 0,
        last_seen INTEGER,
        FOREIGN KEY (headset_id) REFERENCES headsets(id)
      )
    `);

    // Migração: adicionar coluna hostname se não existir
    this._migrateAddHostname();
  }

  /**
   * Migração para adicionar coluna hostname em tabelas existentes
   */
  _migrateAddHostname() {
    const tables = ['headsets', 'dongles'];

    for (const table of tables) {
      try {
        const columns = this.db.prepare(`PRAGMA table_info(${table})`).all();
        const hasHostname = columns.some(col => col.name === 'hostname');

        if (!hasHostname) {
          this.db.exec(`ALTER TABLE ${table} ADD COLUMN hostname TEXT NOT NULL DEFAULT ''`);
          console.log(`[HeadsetManager] Migração: coluna hostname adicionada em ${table}`);
        }
      } catch (error) {
        // Ignorar erros de migração
      }
    }
  }

  /**
   * Carrega headsets registrados do banco de dados
   */
  _loadRegisteredHeadsets() {
    const stmt = this.db.prepare('SELECT * FROM headsets ORDER BY number ASC');
    const rows = stmt.all();

    rows.forEach(row => {
      this.registeredHeadsets.set(row.id, {
        id: row.id,
        hostname: row.hostname || this.options.hostname,
        serialNumber: row.serial_number,
        name: row.name,
        model: row.model,
        color: row.color,
        number: row.number,
        firmwareVersion: row.firmware_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    });

    console.log(`[HeadsetManager] ${this.registeredHeadsets.size} headsets carregados`);
  }

  /**
   * Registra um novo headset
   */
  registerHeadset(headsetData) {
    const id = headsetData.id || this._generateId();
    const now = Date.now();

    // Encontrar próximo número disponível
    const numbers = Array.from(this.registeredHeadsets.values())
      .map(h => h.number)
      .filter(n => n !== null);
    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

    const headset = {
      id,
      hostname: this.options.hostname,
      serialNumber: headsetData.serialNumber || null,
      name: headsetData.name || `Headset ${nextNumber}`,
      model: headsetData.model || 'Jabra Engage 55 Mono',
      color: headsetData.color || 'blue',
      number: headsetData.number || nextNumber,
      firmwareVersion: headsetData.firmwareVersion || null,
      createdAt: now,
      updatedAt: now
    };

    // Salvar no banco de dados
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO headsets
      (id, hostname, serial_number, name, model, color, number, firmware_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      headset.id,
      headset.hostname,
      headset.serialNumber,
      headset.name,
      headset.model,
      headset.color,
      headset.number,
      headset.firmwareVersion,
      headset.createdAt,
      headset.updatedAt
    );

    this.registeredHeadsets.set(id, headset);

    console.log(`[HeadsetManager] Headset registrado: ${headset.name}`);
    this.emit('headsetRegistered', headset);

    return headset;
  }

  /**
   * Atualiza configurações de um headset
   */
  updateHeadset(id, updates) {
    const headset = this.registeredHeadsets.get(id);
    if (!headset) {
      throw new Error(`Headset ${id} não encontrado`);
    }

    const updatedHeadset = {
      ...headset,
      ...updates,
      updatedAt: Date.now()
    };

    // Validar cor
    if (updates.color && !HEADSET_COLORS[updates.color]) {
      throw new Error(`Cor inválida: ${updates.color}`);
    }

    const stmt = this.db.prepare(`
      UPDATE headsets
      SET name = ?, color = ?, number = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedHeadset.name,
      updatedHeadset.color,
      updatedHeadset.number,
      updatedHeadset.updatedAt,
      id
    );

    this.registeredHeadsets.set(id, updatedHeadset);

    console.log(`[HeadsetManager] Headset atualizado: ${updatedHeadset.name}`);
    this.emit('headsetUpdated', updatedHeadset);

    return updatedHeadset;
  }

  /**
   * Remove um headset
   */
  removeHeadset(id) {
    const headset = this.registeredHeadsets.get(id);
    if (!headset) {
      throw new Error(`Headset ${id} não encontrado`);
    }

    const stmt = this.db.prepare('DELETE FROM headsets WHERE id = ?');
    stmt.run(id);

    this.registeredHeadsets.delete(id);
    this.activeHeadsets.delete(id);

    console.log(`[HeadsetManager] Headset removido: ${headset.name}`);
    this.emit('headsetRemoved', { id, headset });

    return true;
  }

  /**
   * Registra conexão de dongle
   */
  dongleConnected(dongleData) {
    const dongle = {
      id: dongleData.id || dongleData.deviceId,
      hostname: this.options.hostname,
      headsetId: dongleData.headsetId || null,
      name: dongleData.name || 'Jabra Dongle',
      connected: true,
      lastSeen: Date.now()
    };

    this.connectedDongles.set(dongle.id, dongle);

    // Salvar no banco
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO dongles (id, hostname, headset_id, name, connected, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(dongle.id, dongle.hostname, dongle.headsetId, dongle.name, 1, dongle.lastSeen);

    console.log(`[HeadsetManager] Dongle conectado: ${dongle.name}`);
    this.emit('dongleConnected', dongle);

    return dongle;
  }

  /**
   * Registra desconexão de dongle
   */
  dongleDisconnected(dongleId) {
    const dongle = this.connectedDongles.get(dongleId);
    if (dongle) {
      dongle.connected = false;
      dongle.lastSeen = Date.now();

      const stmt = this.db.prepare('UPDATE dongles SET connected = 0, last_seen = ? WHERE id = ?');
      stmt.run(dongle.lastSeen, dongleId);

      // Desativar headset associado
      if (dongle.headsetId) {
        this.headsetTurnedOff(dongle.headsetId);
      }
    }

    this.connectedDongles.delete(dongleId);

    console.log(`[HeadsetManager] Dongle desconectado: ${dongleId}`);
    this.emit('dongleDisconnected', { id: dongleId, dongle });
  }

  /**
   * Registra que headset foi ligado
   */
  headsetTurnedOn(headsetId, state = {}) {
    let headset = this.registeredHeadsets.get(headsetId);

    // Se não existe, registrar automaticamente
    if (!headset) {
      headset = this.registerHeadset({
        id: headsetId,
        serialNumber: state.serialNumber,
        name: state.name || 'Novo Headset',
        model: state.model,
        firmwareVersion: state.firmwareVersion
      });
    }

    const activeHeadset = {
      ...headset,
      hostname: this.options.hostname,
      isOn: true,
      batteryLevel: state.batteryLevel || null,
      isCharging: state.isCharging || false,
      isInCall: state.isInCall || false,
      isMuted: state.isMuted || false,
      signalStrength: state.signalStrength || null,
      lastUpdate: Date.now()
    };

    this.activeHeadsets.set(headsetId, activeHeadset);

    console.log(`[HeadsetManager] Headset ligado: ${headset.name}`);
    this.emit('headsetTurnedOn', activeHeadset);

    return activeHeadset;
  }

  /**
   * Registra que headset foi desligado
   */
  headsetTurnedOff(headsetId) {
    const activeHeadset = this.activeHeadsets.get(headsetId);

    if (activeHeadset) {
      this.activeHeadsets.delete(headsetId);
      console.log(`[HeadsetManager] Headset desligado: ${activeHeadset.name}`);
      this.emit('headsetTurnedOff', { id: headsetId, headset: activeHeadset });
    }
  }

  /**
   * Atualiza estado de um headset ativo
   */
  updateHeadsetState(headsetId, state) {
    const activeHeadset = this.activeHeadsets.get(headsetId);

    if (activeHeadset) {
      Object.assign(activeHeadset, state, { lastUpdate: Date.now() });
      this.emit('headsetStateUpdated', activeHeadset);
      return activeHeadset;
    }

    return null;
  }

  /**
   * Obtém todos os headsets registrados
   */
  getRegisteredHeadsets() {
    return Array.from(this.registeredHeadsets.values());
  }

  /**
   * Obtém todos os headsets ativos (ligados)
   */
  getActiveHeadsets() {
    return Array.from(this.activeHeadsets.values());
  }

  /**
   * Obtém todos os dongles conectados
   */
  getConnectedDongles() {
    return Array.from(this.connectedDongles.values());
  }

  /**
   * Obtém headset por ID
   */
  getHeadset(id) {
    return this.registeredHeadsets.get(id) || null;
  }

  /**
   * Obtém estado completo do sistema
   */
  getSystemState() {
    return {
      hostname: this.options.hostname,
      registeredHeadsets: this.getRegisteredHeadsets(),
      activeHeadsets: this.getActiveHeadsets(),
      connectedDongles: this.getConnectedDongles(),
      availableColors: HEADSET_COLORS
    };
  }

  /**
   * Gera ID único
   */
  _generateId() {
    return `hs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Finaliza o gerenciador
   */
  async shutdown() {
    if (this.db) {
      this.db.close();
    }
    console.log('[HeadsetManager] Finalizado');
    this.emit('shutdown');
  }
}

module.exports = { HeadsetManager, HEADSET_COLORS };
