/**
 * EventLogger - Sistema de logs de eventos persistente
 *
 * Registra todos os eventos do sistema para análise posterior:
 * - Conexão/desconexão de dongles USB
 * - Headset ligado/desligado
 * - Mudanças de estado (bateria, chamada, mute)
 * - Alertas (bateria baixa)
 * - Erros do sistema
 */

const { EventEmitter } = require('events');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Tipos de eventos
const EVENT_TYPES = {
  // Dongle USB
  DONGLE_CONNECTED: 'dongle_connected',
  DONGLE_DISCONNECTED: 'dongle_disconnected',
  DONGLE_ERROR: 'dongle_error',

  // Headset
  HEADSET_TURNED_ON: 'headset_turned_on',
  HEADSET_TURNED_OFF: 'headset_turned_off',
  HEADSET_REGISTERED: 'headset_registered',
  HEADSET_REMOVED: 'headset_removed',
  HEADSET_UPDATED: 'headset_updated',

  // Estado do headset
  BATTERY_LEVEL_CHANGED: 'battery_level_changed',
  BATTERY_LOW: 'battery_low',
  BATTERY_CRITICAL: 'battery_critical',
  CHARGING_STARTED: 'charging_started',
  CHARGING_STOPPED: 'charging_stopped',
  CALL_STARTED: 'call_started',
  CALL_ENDED: 'call_ended',
  MUTE_CHANGED: 'mute_changed',

  // Sistema
  SERVER_STARTED: 'server_started',
  SERVER_STOPPED: 'server_stopped',
  CONNECTION_LOST: 'connection_lost',
  ERROR: 'error'
};

// Severidade dos eventos
const SEVERITY = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

class EventLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), 'data'),
      hostname: options.hostname || os.hostname(),
      maxLogAge: options.maxLogAge || 30 * 24 * 60 * 60 * 1000, // 30 dias em ms
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 24h
      ...options
    };

    this.db = null;
    this._cleanupIntervalId = null;
  }

  /**
   * Inicializa o logger
   */
  async initialize() {
    try {
      if (!fs.existsSync(this.options.dataDir)) {
        fs.mkdirSync(this.options.dataDir, { recursive: true });
      }

      const dbPath = path.join(this.options.dataDir, 'event_logs.db');
      this.db = new Database(dbPath);

      this._createTables();
      this._createIndexes();

      // Limpeza periódica de logs antigos
      this._cleanupIntervalId = setInterval(() => {
        this._cleanupOldLogs();
      }, this.options.cleanupInterval);

      console.log('[EventLogger] Inicializado com sucesso');

      // Log inicial
      this.log(EVENT_TYPES.SERVER_STARTED, {
        message: 'Sistema iniciado',
        version: require('../package.json').version
      });

      return true;
    } catch (error) {
      console.error('[EventLogger] Erro na inicialização:', error);
      return false;
    }
  }

  /**
   * Cria tabelas no banco de dados
   */
  _createTables() {
    // Tabela principal de eventos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        source TEXT,
        headset_id TEXT,
        dongle_id TEXT,
        message TEXT,
        data TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Tabela de histórico de conexões de dongle
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dongle_connection_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL,
        dongle_id TEXT NOT NULL,
        dongle_name TEXT,
        event_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details TEXT
      )
    `);

    // Tabela de sessões de headset (ligado/desligado)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS headset_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hostname TEXT NOT NULL,
        headset_id TEXT NOT NULL,
        headset_name TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_minutes REAL,
        start_battery INTEGER,
        end_battery INTEGER,
        total_call_time_minutes REAL DEFAULT 0,
        disconnect_reason TEXT
      )
    `);
  }

  /**
   * Cria índices para performance
   */
  _createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_event_logs_hostname ON event_logs(hostname)',
      'CREATE INDEX IF NOT EXISTS idx_event_logs_headset ON event_logs(headset_id)',
      'CREATE INDEX IF NOT EXISTS idx_event_logs_dongle ON event_logs(dongle_id)',
      'CREATE INDEX IF NOT EXISTS idx_dongle_history_timestamp ON dongle_connection_history(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_dongle_history_dongle ON dongle_connection_history(dongle_id)',
      'CREATE INDEX IF NOT EXISTS idx_headset_sessions_headset ON headset_sessions(headset_id)',
      'CREATE INDEX IF NOT EXISTS idx_headset_sessions_started ON headset_sessions(started_at)'
    ];

    indexes.forEach(sql => {
      try {
        this.db.exec(sql);
      } catch (e) {
        // Índice já existe
      }
    });
  }

  /**
   * Registra um evento no log
   */
  log(eventType, data = {}, severity = SEVERITY.INFO) {
    const timestamp = Date.now();

    const logEntry = {
      hostname: this.options.hostname,
      timestamp,
      event_type: eventType,
      severity,
      source: data.source || null,
      headset_id: data.headsetId || null,
      dongle_id: data.dongleId || null,
      message: data.message || null,
      data: data.details ? JSON.stringify(data.details) : null,
      created_at: timestamp
    };

    try {
      const stmt = this.db.prepare(`
        INSERT INTO event_logs (hostname, timestamp, event_type, severity, source, headset_id, dongle_id, message, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        logEntry.hostname,
        logEntry.timestamp,
        logEntry.event_type,
        logEntry.severity,
        logEntry.source,
        logEntry.headset_id,
        logEntry.dongle_id,
        logEntry.message,
        logEntry.data,
        logEntry.created_at
      );

      logEntry.id = result.lastInsertRowid;

      // Emitir evento para listeners em tempo real
      this.emit('logged', logEntry);

      return logEntry;
    } catch (error) {
      console.error('[EventLogger] Erro ao salvar log:', error);
      return null;
    }
  }

  // === Métodos de conveniência para tipos específicos ===

  logDongleConnected(dongleId, dongleName, details = {}) {
    this._logDongleHistory(dongleId, dongleName, 'connected', details);
    return this.log(EVENT_TYPES.DONGLE_CONNECTED, {
      dongleId,
      message: `Dongle conectado: ${dongleName}`,
      details: { dongleName, ...details }
    }, SEVERITY.INFO);
  }

  logDongleDisconnected(dongleId, dongleName, reason = 'unknown', details = {}) {
    this._logDongleHistory(dongleId, dongleName, 'disconnected', { reason, ...details });
    return this.log(EVENT_TYPES.DONGLE_DISCONNECTED, {
      dongleId,
      message: `Dongle desconectado: ${dongleName} (${reason})`,
      details: { dongleName, reason, ...details }
    }, reason === 'error' ? SEVERITY.ERROR : SEVERITY.WARNING);
  }

  logDongleError(dongleId, dongleName, error, details = {}) {
    this._logDongleHistory(dongleId, dongleName, 'error', { error: error.message, ...details });
    return this.log(EVENT_TYPES.DONGLE_ERROR, {
      dongleId,
      message: `Erro no dongle: ${dongleName} - ${error.message || error}`,
      details: { dongleName, error: error.message || error, ...details }
    }, SEVERITY.ERROR);
  }

  _logDongleHistory(dongleId, dongleName, eventType, details = {}) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO dongle_connection_history (hostname, dongle_id, dongle_name, event_type, timestamp, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        this.options.hostname,
        dongleId,
        dongleName,
        eventType,
        Date.now(),
        JSON.stringify(details)
      );
    } catch (error) {
      console.error('[EventLogger] Erro ao salvar histórico de dongle:', error);
    }
  }

  logHeadsetTurnedOn(headsetId, headsetName, batteryLevel, details = {}) {
    this._startHeadsetSession(headsetId, headsetName, batteryLevel);
    return this.log(EVENT_TYPES.HEADSET_TURNED_ON, {
      headsetId,
      message: `Headset ligado: ${headsetName} (${batteryLevel}%)`,
      details: { headsetName, batteryLevel, ...details }
    }, SEVERITY.INFO);
  }

  logHeadsetTurnedOff(headsetId, headsetName, batteryLevel, reason = 'normal', details = {}) {
    this._endHeadsetSession(headsetId, batteryLevel, reason);
    return this.log(EVENT_TYPES.HEADSET_TURNED_OFF, {
      headsetId,
      message: `Headset desligado: ${headsetName} (${reason})`,
      details: { headsetName, batteryLevel, reason, ...details }
    }, reason === 'connection_lost' ? SEVERITY.WARNING : SEVERITY.INFO);
  }

  _startHeadsetSession(headsetId, headsetName, batteryLevel) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO headset_sessions (hostname, headset_id, headset_name, started_at, start_battery)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(this.options.hostname, headsetId, headsetName, Date.now(), batteryLevel);
    } catch (error) {
      console.error('[EventLogger] Erro ao iniciar sessão:', error);
    }
  }

  _endHeadsetSession(headsetId, batteryLevel, reason) {
    try {
      const endTime = Date.now();

      // Encontrar sessão aberta mais recente
      const session = this.db.prepare(`
        SELECT * FROM headset_sessions
        WHERE headset_id = ? AND ended_at IS NULL
        ORDER BY started_at DESC LIMIT 1
      `).get(headsetId);

      if (session) {
        const durationMinutes = (endTime - session.started_at) / 60000;
        const stmt = this.db.prepare(`
          UPDATE headset_sessions
          SET ended_at = ?, end_battery = ?, duration_minutes = ?, disconnect_reason = ?
          WHERE id = ?
        `);
        stmt.run(endTime, batteryLevel, durationMinutes, reason, session.id);
      }
    } catch (error) {
      console.error('[EventLogger] Erro ao finalizar sessão:', error);
    }
  }

  logBatteryLow(headsetId, headsetName, batteryLevel) {
    return this.log(EVENT_TYPES.BATTERY_LOW, {
      headsetId,
      message: `Bateria baixa: ${headsetName} (${batteryLevel}%)`,
      details: { headsetName, batteryLevel }
    }, SEVERITY.WARNING);
  }

  logBatteryCritical(headsetId, headsetName, batteryLevel) {
    return this.log(EVENT_TYPES.BATTERY_CRITICAL, {
      headsetId,
      message: `Bateria crítica: ${headsetName} (${batteryLevel}%)`,
      details: { headsetName, batteryLevel }
    }, SEVERITY.CRITICAL);
  }

  logChargingStarted(headsetId, headsetName, batteryLevel) {
    return this.log(EVENT_TYPES.CHARGING_STARTED, {
      headsetId,
      message: `Carregamento iniciado: ${headsetName} (${batteryLevel}%)`,
      details: { headsetName, batteryLevel }
    }, SEVERITY.INFO);
  }

  logChargingStopped(headsetId, headsetName, batteryLevel) {
    return this.log(EVENT_TYPES.CHARGING_STOPPED, {
      headsetId,
      message: `Carregamento finalizado: ${headsetName} (${batteryLevel}%)`,
      details: { headsetName, batteryLevel }
    }, SEVERITY.INFO);
  }

  logCallStarted(headsetId, headsetName) {
    return this.log(EVENT_TYPES.CALL_STARTED, {
      headsetId,
      message: `Chamada iniciada: ${headsetName}`,
      details: { headsetName }
    }, SEVERITY.INFO);
  }

  logCallEnded(headsetId, headsetName, durationSeconds) {
    this._updateCallTime(headsetId, durationSeconds);
    return this.log(EVENT_TYPES.CALL_ENDED, {
      headsetId,
      message: `Chamada finalizada: ${headsetName} (${Math.round(durationSeconds / 60)}min)`,
      details: { headsetName, durationSeconds }
    }, SEVERITY.INFO);
  }

  _updateCallTime(headsetId, durationSeconds) {
    try {
      const stmt = this.db.prepare(`
        UPDATE headset_sessions
        SET total_call_time_minutes = total_call_time_minutes + ?
        WHERE headset_id = ? AND ended_at IS NULL
      `);
      stmt.run(durationSeconds / 60, headsetId);
    } catch (error) {
      // Ignorar erro
    }
  }

  logError(source, error, details = {}) {
    return this.log(EVENT_TYPES.ERROR, {
      source,
      message: error.message || error,
      details: { error: error.stack || error, ...details }
    }, SEVERITY.ERROR);
  }

  // === Métodos de consulta ===

  /**
   * Busca logs com filtros
   */
  getLogs(options = {}) {
    const {
      limit = 100,
      offset = 0,
      eventType = null,
      severity = null,
      headsetId = null,
      dongleId = null,
      startTime = null,
      endTime = null
    } = options;

    let sql = 'SELECT * FROM event_logs WHERE 1=1';
    const params = [];

    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }

    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }

    if (headsetId) {
      sql += ' AND headset_id = ?';
      params.push(headsetId);
    }

    if (dongleId) {
      sql += ' AND dongle_id = ?';
      params.push(dongleId);
    }

    if (startTime) {
      sql += ' AND timestamp >= ?';
      params.push(startTime);
    }

    if (endTime) {
      sql += ' AND timestamp <= ?';
      params.push(endTime);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null
    }));
  }

  /**
   * Busca histórico de conexões de dongle
   */
  getDongleHistory(dongleId = null, limit = 100) {
    let sql = 'SELECT * FROM dongle_connection_history';
    const params = [];

    if (dongleId) {
      sql += ' WHERE dongle_id = ?';
      params.push(dongleId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));
  }

  /**
   * Busca sessões de headset
   */
  getHeadsetSessions(headsetId = null, limit = 50) {
    let sql = 'SELECT * FROM headset_sessions';
    const params = [];

    if (headsetId) {
      sql += ' WHERE headset_id = ?';
      params.push(headsetId);
    }

    sql += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Estatísticas de logs
   */
  getLogStats(hours = 24) {
    const since = Date.now() - (hours * 60 * 60 * 1000);

    const stats = {
      totalEvents: 0,
      byType: {},
      bySeverity: {},
      dongleDisconnects: 0,
      headsetSessions: 0,
      averageSessionMinutes: 0,
      errors: 0
    };

    // Total e por tipo
    const typeStats = this.db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM event_logs
      WHERE timestamp >= ?
      GROUP BY event_type
    `).all(since);

    typeStats.forEach(row => {
      stats.byType[row.event_type] = row.count;
      stats.totalEvents += row.count;
    });

    // Por severidade
    const severityStats = this.db.prepare(`
      SELECT severity, COUNT(*) as count
      FROM event_logs
      WHERE timestamp >= ?
      GROUP BY severity
    `).all(since);

    severityStats.forEach(row => {
      stats.bySeverity[row.severity] = row.count;
      if (row.severity === 'error' || row.severity === 'critical') {
        stats.errors += row.count;
      }
    });

    // Desconexões de dongle
    stats.dongleDisconnects = this.db.prepare(`
      SELECT COUNT(*) as count FROM dongle_connection_history
      WHERE event_type = 'disconnected' AND timestamp >= ?
    `).get(since).count;

    // Sessões de headset
    const sessionStats = this.db.prepare(`
      SELECT COUNT(*) as count, AVG(duration_minutes) as avg_duration
      FROM headset_sessions
      WHERE started_at >= ?
    `).get(since);

    stats.headsetSessions = sessionStats.count;
    stats.averageSessionMinutes = Math.round(sessionStats.avg_duration || 0);

    return stats;
  }

  /**
   * Limpa logs antigos
   */
  _cleanupOldLogs() {
    const cutoff = Date.now() - this.options.maxLogAge;

    try {
      this.db.prepare('DELETE FROM event_logs WHERE timestamp < ?').run(cutoff);
      this.db.prepare('DELETE FROM dongle_connection_history WHERE timestamp < ?').run(cutoff);
      console.log('[EventLogger] Logs antigos removidos');
    } catch (error) {
      console.error('[EventLogger] Erro na limpeza:', error);
    }
  }

  /**
   * Finaliza o logger
   */
  async shutdown() {
    console.log('[EventLogger] Finalizando...');

    this.log(EVENT_TYPES.SERVER_STOPPED, {
      message: 'Sistema finalizado'
    });

    if (this._cleanupIntervalId) {
      clearInterval(this._cleanupIntervalId);
    }

    if (this.db) {
      this.db.close();
    }

    console.log('[EventLogger] Finalizado');
  }
}

module.exports = { EventLogger, EVENT_TYPES, SEVERITY };
