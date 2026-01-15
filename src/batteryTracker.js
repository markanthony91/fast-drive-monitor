/**
 * BatteryTracker - Módulo de rastreamento e análise de bateria
 *
 * Monitora o comportamento da bateria do headset para:
 * - Calcular tempo de carregamento (0% a 100%)
 * - Estimar duração da bateria baseado no uso
 * - Detectar quando carregador é plugado/desplugado
 * - Manter histórico de ciclos de carregamento
 */

const { EventEmitter } = require('events');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configurações padrão do Jabra Engage 55 Mono
const DEFAULT_SPECS = {
  batteryCapacity: 140, // mAh (estimativa)
  talkTime: 13 * 60,    // 13 horas em minutos
  standbyTime: 50 * 60, // 50 horas em minutos
  chargingTime: 90,     // 90 minutos para carga completa (estimativa)
  minBatteryLevel: 0,
  maxBatteryLevel: 100
};

// Fatores de consumo de bateria
const CONSUMPTION_FACTORS = {
  idle: 1.0,          // Standby
  inCall: 3.5,        // Em chamada (maior consumo)
  streaming: 2.5,     // Streaming de áudio
  muted: 0.9          // Mutado (ligeiramente menor)
};

class BatteryTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), 'data'),
      saveInterval: options.saveInterval || 60000, // Salvar a cada minuto
      hostname: options.hostname || os.hostname(),
      ...DEFAULT_SPECS
    };

    // Estado atual
    this.currentState = {
      batteryLevel: null,
      isCharging: false,
      isInCall: false,
      isMuted: false,
      isPowerOn: false
    };

    // Sessão de carregamento atual
    this.chargingSession = null;

    // Sessão de uso atual
    this.usageSession = null;

    // Estatísticas acumuladas
    this.stats = {
      totalChargingSessions: 0,
      averageChargingTime: 0,
      averageBatteryDrain: 0,
      totalUsageTime: 0,
      totalCallTime: 0
    };

    // Histórico recente (em memória)
    this.batteryHistory = [];
    this.maxHistorySize = 1000;

    this.db = null;
    this._saveIntervalId = null;
  }

  /**
   * Inicializa o tracker e carrega dados persistidos
   */
  async initialize() {
    try {
      // Criar diretório de dados se não existir
      if (!fs.existsSync(this.options.dataDir)) {
        fs.mkdirSync(this.options.dataDir, { recursive: true });
      }

      // Inicializar banco de dados SQLite
      const dbPath = path.join(this.options.dataDir, 'battery_tracker.db');
      this.db = new Database(dbPath);

      // Criar tabelas
      this._createTables();

      // Carregar estatísticas
      await this._loadStats();

      // Iniciar salvamento periódico
      this._saveIntervalId = setInterval(() => {
        this._saveCurrentSession();
      }, this.options.saveInterval);

      console.log('[BatteryTracker] Inicializado com sucesso');
      this.emit('ready');

      return true;
    } catch (error) {
      console.error('[BatteryTracker] Erro na inicialização:', error);
      this.emit('error', { type: 'initialization', error });
      return false;
    }
  }

  /**
   * Cria tabelas no banco de dados
   */
  _createTables() {
    // Tabela de sessões de carregamento
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS charging_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL DEFAULT '',
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        start_level INTEGER NOT NULL,
        end_level INTEGER,
        duration_minutes REAL,
        charging_rate REAL,
        completed INTEGER DEFAULT 0
      )
    `);

    // Tabela de sessões de uso
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL DEFAULT '',
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        start_level INTEGER NOT NULL,
        end_level INTEGER,
        duration_minutes REAL,
        call_time_minutes REAL DEFAULT 0,
        drain_rate REAL
      )
    `);

    // Tabela de histórico de bateria
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS battery_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL DEFAULT '',
        timestamp INTEGER NOT NULL,
        battery_level INTEGER NOT NULL,
        is_charging INTEGER NOT NULL,
        is_in_call INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0
      )
    `);

    // Tabela de estatísticas agregadas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        hostname TEXT NOT NULL DEFAULT '',
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Migração: adicionar coluna hostname se não existir (para bancos existentes)
    this._migrateAddHostname();
  }

  /**
   * Migração para adicionar coluna hostname em tabelas existentes
   */
  _migrateAddHostname() {
    const tables = ['charging_sessions', 'usage_sessions', 'battery_history', 'stats'];

    for (const table of tables) {
      try {
        // Verificar se coluna existe
        const columns = this.db.prepare(`PRAGMA table_info(${table})`).all();
        const hasHostname = columns.some(col => col.name === 'hostname');

        if (!hasHostname) {
          this.db.exec(`ALTER TABLE ${table} ADD COLUMN hostname TEXT NOT NULL DEFAULT ''`);
          console.log(`[BatteryTracker] Migração: coluna hostname adicionada em ${table}`);
        }
      } catch (error) {
        // Ignorar erros de migração (coluna pode já existir)
      }
    }
  }

  /**
   * Carrega estatísticas do banco de dados
   */
  async _loadStats() {
    const stmt = this.db.prepare('SELECT key, value FROM stats');
    const rows = stmt.all();

    rows.forEach(row => {
      if (this.stats.hasOwnProperty(row.key)) {
        this.stats[row.key] = JSON.parse(row.value);
      }
    });

    // Calcular estatísticas de sessões de carregamento
    const chargingStats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(duration_minutes) as avgTime
      FROM charging_sessions
      WHERE completed = 1
    `).get();

    if (chargingStats) {
      this.stats.totalChargingSessions = chargingStats.total || 0;
      this.stats.averageChargingTime = chargingStats.avgTime || 0;
    }
  }

  /**
   * Salva estatísticas no banco de dados
   */
  _saveStats() {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO stats (key, hostname, value, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const now = Date.now();
    Object.entries(this.stats).forEach(([key, value]) => {
      stmt.run(key, this.options.hostname, JSON.stringify(value), now);
    });
  }

  /**
   * Atualiza nível de bateria
   */
  updateBatteryLevel(level, isCharging) {
    const previousLevel = this.currentState.batteryLevel;
    const wasCharging = this.currentState.isCharging;

    this.currentState.batteryLevel = level;
    this.currentState.isCharging = isCharging;

    // Registrar no histórico
    this._recordBatteryPoint(level, isCharging);

    // Detectar início/fim de carregamento
    if (isCharging && !wasCharging) {
      this._startChargingSession(level);
    } else if (!isCharging && wasCharging) {
      this._endChargingSession(level);
    }

    // Atualizar sessão de uso
    if (!isCharging && this.usageSession) {
      this.usageSession.currentLevel = level;
    }

    // Calcular estimativas
    const estimates = this.calculateEstimates();

    this.emit('batteryUpdate', {
      level,
      previousLevel,
      isCharging,
      estimates
    });
  }

  /**
   * Registra ponto no histórico de bateria
   */
  _recordBatteryPoint(level, isCharging) {
    const point = {
      timestamp: Date.now(),
      batteryLevel: level,
      isCharging,
      isInCall: this.currentState.isInCall,
      isMuted: this.currentState.isMuted
    };

    // Adicionar ao histórico em memória
    this.batteryHistory.push(point);
    if (this.batteryHistory.length > this.maxHistorySize) {
      this.batteryHistory.shift();
    }

    // Salvar no banco de dados
    const stmt = this.db.prepare(`
      INSERT INTO battery_history (hostname, timestamp, battery_level, is_charging, is_in_call, is_muted)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(this.options.hostname, point.timestamp, level, isCharging ? 1 : 0,
      point.isInCall ? 1 : 0, point.isMuted ? 1 : 0);
  }

  /**
   * Inicia sessão de carregamento
   */
  _startChargingSession(startLevel) {
    // Finalizar sessão de uso se existir
    if (this.usageSession) {
      this._endUsageSession(startLevel);
    }

    this.chargingSession = {
      id: null,
      startTime: Date.now(),
      startLevel,
      currentLevel: startLevel,
      endLevel: null,
      endTime: null
    };

    // Salvar no banco de dados
    const stmt = this.db.prepare(`
      INSERT INTO charging_sessions (hostname, start_time, start_level)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(this.options.hostname, this.chargingSession.startTime, startLevel);
    this.chargingSession.id = result.lastInsertRowid;

    console.log(`[BatteryTracker] Carregamento iniciado: ${startLevel}%`);

    this.emit('chargingStarted', {
      startLevel,
      startTime: this.chargingSession.startTime,
      estimatedTimeToFull: this.estimateTimeToFullCharge(startLevel)
    });
  }

  /**
   * Finaliza sessão de carregamento
   */
  _endChargingSession(endLevel) {
    if (!this.chargingSession) return;

    const endTime = Date.now();
    const durationMs = endTime - this.chargingSession.startTime;
    const durationMinutes = durationMs / 60000;
    const levelGained = endLevel - this.chargingSession.startLevel;
    const chargingRate = levelGained / durationMinutes; // % por minuto

    // Atualizar banco de dados
    const stmt = this.db.prepare(`
      UPDATE charging_sessions
      SET end_time = ?, end_level = ?, duration_minutes = ?, charging_rate = ?, completed = ?
      WHERE id = ?
    `);
    stmt.run(endTime, endLevel, durationMinutes, chargingRate,
      endLevel >= 100 ? 1 : 0, this.chargingSession.id);

    console.log(`[BatteryTracker] Carregamento finalizado: ${this.chargingSession.startLevel}% -> ${endLevel}% em ${durationMinutes.toFixed(1)} min`);

    this.emit('chargingEnded', {
      startLevel: this.chargingSession.startLevel,
      endLevel,
      durationMinutes,
      chargingRate,
      completed: endLevel >= 100
    });

    this.chargingSession = null;

    // Iniciar nova sessão de uso
    this._startUsageSession(endLevel);
  }

  /**
   * Inicia sessão de uso
   */
  _startUsageSession(startLevel) {
    this.usageSession = {
      id: null,
      startTime: Date.now(),
      startLevel,
      currentLevel: startLevel,
      callTimeMs: 0,
      lastCallStart: null
    };

    // Salvar no banco de dados
    const stmt = this.db.prepare(`
      INSERT INTO usage_sessions (hostname, start_time, start_level)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(this.options.hostname, this.usageSession.startTime, startLevel);
    this.usageSession.id = result.lastInsertRowid;

    console.log(`[BatteryTracker] Sessão de uso iniciada: ${startLevel}%`);

    this.emit('usageStarted', {
      startLevel,
      startTime: this.usageSession.startTime,
      estimatedBatteryLife: this.estimateBatteryLife(startLevel)
    });
  }

  /**
   * Finaliza sessão de uso
   */
  _endUsageSession(endLevel) {
    if (!this.usageSession) return;

    const endTime = Date.now();
    const durationMs = endTime - this.usageSession.startTime;
    const durationMinutes = durationMs / 60000;
    const levelDrained = this.usageSession.startLevel - endLevel;
    const drainRate = levelDrained / durationMinutes; // % por minuto
    const callTimeMinutes = this.usageSession.callTimeMs / 60000;

    // Atualizar banco de dados
    const stmt = this.db.prepare(`
      UPDATE usage_sessions
      SET end_time = ?, end_level = ?, duration_minutes = ?, call_time_minutes = ?, drain_rate = ?
      WHERE id = ?
    `);
    stmt.run(endTime, endLevel, durationMinutes, callTimeMinutes, drainRate, this.usageSession.id);

    console.log(`[BatteryTracker] Sessão de uso finalizada: ${this.usageSession.startLevel}% -> ${endLevel}% em ${durationMinutes.toFixed(1)} min`);

    this.emit('usageEnded', {
      startLevel: this.usageSession.startLevel,
      endLevel,
      durationMinutes,
      callTimeMinutes,
      drainRate
    });

    this.usageSession = null;
  }

  /**
   * Atualiza estado de chamada
   */
  updateCallState(isInCall) {
    const wasInCall = this.currentState.isInCall;
    this.currentState.isInCall = isInCall;

    if (this.usageSession) {
      if (isInCall && !wasInCall) {
        // Chamada iniciada
        this.usageSession.lastCallStart = Date.now();
      } else if (!isInCall && wasInCall && this.usageSession.lastCallStart) {
        // Chamada finalizada
        const callDuration = Date.now() - this.usageSession.lastCallStart;
        this.usageSession.callTimeMs += callDuration;
        this.usageSession.lastCallStart = null;
      }
    }

    this.emit('callStateUpdate', { isInCall, wasInCall });
  }

  /**
   * Atualiza estado de mudo
   */
  updateMuteState(isMuted) {
    this.currentState.isMuted = isMuted;
    this.emit('muteStateUpdate', { isMuted });
  }

  /**
   * Atualiza estado de energia
   */
  updatePowerState(isPowerOn) {
    const wasPowerOn = this.currentState.isPowerOn;
    this.currentState.isPowerOn = isPowerOn;

    if (!isPowerOn && wasPowerOn) {
      // Dispositivo desligado - finalizar sessões
      if (this.chargingSession) {
        this._endChargingSession(this.currentState.batteryLevel);
      }
      if (this.usageSession) {
        this._endUsageSession(this.currentState.batteryLevel);
      }
    }

    this.emit('powerStateUpdate', { isPowerOn, wasPowerOn });
  }

  /**
   * Calcula estimativas atuais
   */
  calculateEstimates() {
    const { batteryLevel, isCharging, isInCall } = this.currentState;

    if (batteryLevel === null) {
      return null;
    }

    return {
      batteryLevel,
      isCharging,
      timeToFullCharge: isCharging ? this.estimateTimeToFullCharge(batteryLevel) : null,
      timeToEmpty: !isCharging ? this.estimateBatteryLife(batteryLevel, isInCall) : null,
      chargingRate: this.getAverageChargingRate(),
      drainRate: this.getAverageDrainRate(isInCall)
    };
  }

  /**
   * Estima tempo para carga completa
   */
  estimateTimeToFullCharge(currentLevel) {
    const levelNeeded = 100 - currentLevel;
    const avgRate = this.getAverageChargingRate();

    if (avgRate <= 0) {
      // Usar especificação padrão se não tiver dados
      const defaultRate = 100 / this.options.chargingTime; // % por minuto
      return levelNeeded / defaultRate;
    }

    return levelNeeded / avgRate; // minutos
  }

  /**
   * Estima tempo restante de bateria
   */
  estimateBatteryLife(currentLevel, isInCall = false) {
    const avgDrainRate = this.getAverageDrainRate(isInCall);

    if (avgDrainRate <= 0) {
      // Usar especificação padrão
      const baseTime = isInCall ? this.options.talkTime : this.options.standbyTime;
      return (currentLevel / 100) * baseTime;
    }

    return currentLevel / avgDrainRate; // minutos
  }

  /**
   * Obtém taxa média de carregamento
   */
  getAverageChargingRate() {
    const stmt = this.db.prepare(`
      SELECT AVG(charging_rate) as avgRate
      FROM charging_sessions
      WHERE charging_rate > 0 AND completed = 1
      ORDER BY start_time DESC
      LIMIT 10
    `);
    const result = stmt.get();
    return result?.avgRate || 0;
  }

  /**
   * Obtém taxa média de descarga
   */
  getAverageDrainRate(isInCall = false) {
    // Usar dados recentes para estimativa mais precisa
    const stmt = this.db.prepare(`
      SELECT AVG(drain_rate) as avgRate
      FROM usage_sessions
      WHERE drain_rate > 0
      ORDER BY start_time DESC
      LIMIT 10
    `);
    const result = stmt.get();
    const baseRate = result?.avgRate || 0;

    if (baseRate <= 0) return 0;

    // Ajustar pela atividade atual
    const factor = isInCall ? CONSUMPTION_FACTORS.inCall : CONSUMPTION_FACTORS.idle;
    return baseRate * factor;
  }

  /**
   * Obtém histórico de sessões de carregamento
   */
  getChargingHistory(limit = 50) {
    const stmt = this.db.prepare(`
      SELECT *
      FROM charging_sessions
      ORDER BY start_time DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  /**
   * Obtém histórico de sessões de uso
   */
  getUsageHistory(limit = 50) {
    const stmt = this.db.prepare(`
      SELECT *
      FROM usage_sessions
      ORDER BY start_time DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  /**
   * Obtém histórico de bateria
   */
  getBatteryHistory(hours = 24) {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const stmt = this.db.prepare(`
      SELECT *
      FROM battery_history
      WHERE timestamp >= ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(since);
  }

  /**
   * Obtém estatísticas completas
   */
  getStatistics() {
    // Estatísticas de carregamento
    const chargingStats = this.db.prepare(`
      SELECT
        COUNT(*) as totalSessions,
        AVG(duration_minutes) as avgDuration,
        MIN(duration_minutes) as minDuration,
        MAX(duration_minutes) as maxDuration,
        AVG(charging_rate) as avgRate,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completedSessions
      FROM charging_sessions
    `).get();

    // Estatísticas de uso
    const usageStats = this.db.prepare(`
      SELECT
        COUNT(*) as totalSessions,
        AVG(duration_minutes) as avgDuration,
        SUM(duration_minutes) as totalUsageTime,
        SUM(call_time_minutes) as totalCallTime,
        AVG(drain_rate) as avgDrainRate
      FROM usage_sessions
    `).get();

    return {
      charging: chargingStats,
      usage: usageStats,
      current: this.currentState,
      estimates: this.calculateEstimates()
    };
  }

  /**
   * Salva sessão atual periodicamente
   */
  _saveCurrentSession() {
    this._saveStats();

    if (this.chargingSession && this.currentState.batteryLevel) {
      const stmt = this.db.prepare(`
        UPDATE charging_sessions
        SET end_level = ?
        WHERE id = ?
      `);
      stmt.run(this.currentState.batteryLevel, this.chargingSession.id);
    }

    if (this.usageSession && this.currentState.batteryLevel) {
      const stmt = this.db.prepare(`
        UPDATE usage_sessions
        SET end_level = ?, call_time_minutes = ?
        WHERE id = ?
      `);
      stmt.run(
        this.currentState.batteryLevel,
        this.usageSession.callTimeMs / 60000,
        this.usageSession.id
      );
    }
  }

  /**
   * Finaliza e libera recursos
   */
  async shutdown() {
    console.log('[BatteryTracker] Finalizando...');

    // Parar salvamento periódico
    if (this._saveIntervalId) {
      clearInterval(this._saveIntervalId);
    }

    // Salvar sessões atuais
    if (this.chargingSession) {
      this._endChargingSession(this.currentState.batteryLevel);
    }
    if (this.usageSession) {
      this._endUsageSession(this.currentState.batteryLevel);
    }

    // Salvar estatísticas
    this._saveStats();

    // Fechar banco de dados
    if (this.db) {
      this.db.close();
    }

    console.log('[BatteryTracker] Finalizado');
    this.emit('shutdown');
  }
}

module.exports = { BatteryTracker, DEFAULT_SPECS, CONSUMPTION_FACTORS };
