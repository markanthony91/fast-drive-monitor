/**
 * Testes automatizados - BatteryTracker
 *
 * Executa: npm test
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { BatteryTracker, DEFAULT_SPECS, CONSUMPTION_FACTORS } = require('./batteryTracker');

// Diretório temporário para testes
const TEST_DATA_DIR = path.join(__dirname, '../data/test-battery');

describe('BatteryTracker', () => {
  let tracker;

  before(() => {
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Fechar tracker anterior se existir
    if (tracker && tracker.db) {
      await tracker.shutdown();
    }

    // Limpar banco de dados
    const dbPath = path.join(TEST_DATA_DIR, 'battery_tracker.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    tracker = new BatteryTracker({
      dataDir: TEST_DATA_DIR,
      hostname: 'test-host',
      saveInterval: 60000 // 1 minuto
    });
    await tracker.initialize();
  });

  after(async () => {
    if (tracker) {
      await tracker.shutdown();
    }

    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe('Inicialização', () => {
    it('deve inicializar corretamente', () => {
      assert.ok(tracker.db, 'Banco de dados deve estar conectado');
      assert.strictEqual(tracker.options.hostname, 'test-host');
    });

    it('deve ter configurações padrão do Jabra Engage 55', () => {
      assert.strictEqual(tracker.options.talkTime, DEFAULT_SPECS.talkTime);
      assert.strictEqual(tracker.options.chargingTime, DEFAULT_SPECS.chargingTime);
    });

    it('deve iniciar com estado zerado', () => {
      assert.strictEqual(tracker.currentState.batteryLevel, null);
      assert.strictEqual(tracker.currentState.isCharging, false);
      assert.strictEqual(tracker.currentState.isInCall, false);
    });
  });

  describe('Atualização de Bateria', () => {
    it('deve atualizar nível de bateria', () => {
      tracker.updateBatteryLevel(75, false);

      assert.strictEqual(tracker.currentState.batteryLevel, 75);
      assert.strictEqual(tracker.currentState.isCharging, false);
    });

    it('deve registrar no histórico', () => {
      tracker.updateBatteryLevel(80, false);
      tracker.updateBatteryLevel(79, false);
      tracker.updateBatteryLevel(78, false);

      assert.strictEqual(tracker.batteryHistory.length, 3);
    });

    it('deve emitir evento batteryUpdate', (_, done) => {
      tracker.once('batteryUpdate', (data) => {
        assert.strictEqual(data.level, 50);
        assert.strictEqual(data.isCharging, true);
        done();
      });

      tracker.updateBatteryLevel(50, true);
    });
  });

  describe('Detecção de Carregamento', () => {
    it('deve detectar início de carregamento', (_, done) => {
      tracker.updateBatteryLevel(30, false);

      tracker.once('chargingStarted', (data) => {
        assert.strictEqual(data.startLevel, 30);
        assert.ok(data.estimatedTimeToFull > 0);
        done();
      });

      tracker.updateBatteryLevel(30, true);
    });

    it('deve detectar fim de carregamento', (_, done) => {
      // Iniciar carregamento
      tracker.updateBatteryLevel(30, false);
      tracker.updateBatteryLevel(30, true);

      tracker.once('chargingEnded', (data) => {
        assert.strictEqual(data.startLevel, 30);
        assert.strictEqual(data.endLevel, 100);
        done();
      });

      // Simular carga completa
      tracker.updateBatteryLevel(100, false);
    });

    it('deve criar sessão de carregamento', () => {
      tracker.updateBatteryLevel(20, false);
      tracker.updateBatteryLevel(20, true);

      assert.ok(tracker.chargingSession, 'Deve ter sessão ativa');
      assert.strictEqual(tracker.chargingSession.startLevel, 20);
    });
  });

  describe('Estados de Chamada e Mudo', () => {
    it('deve atualizar estado de chamada', () => {
      tracker.updateCallState(true);
      assert.strictEqual(tracker.currentState.isInCall, true);

      tracker.updateCallState(false);
      assert.strictEqual(tracker.currentState.isInCall, false);
    });

    it('deve atualizar estado de mudo', () => {
      tracker.updateMuteState(true);
      assert.strictEqual(tracker.currentState.isMuted, true);

      tracker.updateMuteState(false);
      assert.strictEqual(tracker.currentState.isMuted, false);
    });

    it('deve rastrear tempo em chamada', () => {
      // Iniciar sessão de uso
      tracker.updateBatteryLevel(100, true);
      tracker.updateBatteryLevel(100, false); // Fim do carregamento, início do uso

      assert.ok(tracker.usageSession, 'Deve ter sessão de uso');

      // Iniciar chamada
      tracker.updateCallState(true);
      assert.ok(tracker.usageSession.lastCallStart);
    });
  });

  describe('Estimativas', () => {
    it('deve calcular estimativas com bateria conhecida', () => {
      tracker.updateBatteryLevel(50, false);

      const estimates = tracker.calculateEstimates();

      assert.ok(estimates);
      assert.strictEqual(estimates.batteryLevel, 50);
      assert.strictEqual(estimates.isCharging, false);
      assert.ok(estimates.timeToEmpty !== null);
    });

    it('deve estimar tempo para carga completa', () => {
      const timeToFull = tracker.estimateTimeToFullCharge(50);

      assert.ok(timeToFull > 0);
      // Com taxa padrão: 100% em 90min, então 50% deve levar ~45min
      assert.ok(timeToFull > 30 && timeToFull < 60);
    });

    it('deve estimar autonomia da bateria', () => {
      const batteryLife = tracker.estimateBatteryLife(100, false);

      assert.ok(batteryLife > 0);
      // Standby: 50 horas = 3000 min
      assert.ok(batteryLife > 1000); // Deve ser significativo
    });

    it('deve ajustar estimativa para chamada ativa', () => {
      const standbyLife = tracker.estimateBatteryLife(100, false);
      const callLife = tracker.estimateBatteryLife(100, true);

      // Em chamada deve durar menos
      assert.ok(callLife < standbyLife);
    });

    it('deve retornar null se bateria desconhecida', () => {
      const estimates = tracker.calculateEstimates();

      assert.strictEqual(estimates, null);
    });
  });

  describe('Histórico e Estatísticas', () => {
    beforeEach(() => {
      // Simular alguns dados
      tracker.updateBatteryLevel(80, false);
      tracker.updateBatteryLevel(75, false);
      tracker.updateBatteryLevel(70, false);
    });

    it('deve retornar histórico de bateria', () => {
      const history = tracker.getBatteryHistory(24);

      assert.ok(Array.isArray(history));
      assert.strictEqual(history.length, 3);
    });

    it('deve retornar estatísticas', () => {
      const stats = tracker.getStatistics();

      assert.ok(stats.charging);
      assert.ok(stats.usage);
      assert.ok(stats.current);
    });

    it('deve limitar histórico em memória', () => {
      // Adicionar muitos pontos via método correto
      for (let i = 0; i < 1100; i++) {
        tracker.updateBatteryLevel(50, false);
      }

      // Deve estar limitado ao maxHistorySize
      assert.ok(tracker.batteryHistory.length <= tracker.maxHistorySize,
        `Histórico tem ${tracker.batteryHistory.length} itens, deveria ter no máximo ${tracker.maxHistorySize}`);
    });
  });

  describe('Persistência', () => {
    it('deve salvar histórico no banco de dados', () => {
      tracker.updateBatteryLevel(80, false);
      tracker.updateBatteryLevel(75, false);

      // Verificar no banco
      const rows = tracker.db.prepare('SELECT COUNT(*) as count FROM battery_history').get();
      assert.strictEqual(rows.count, 2);
    });

    it('deve incluir hostname nos registros', () => {
      tracker.updateBatteryLevel(80, false);

      const row = tracker.db.prepare('SELECT hostname FROM battery_history LIMIT 1').get();
      assert.strictEqual(row.hostname, 'test-host');
    });
  });

  describe('Fatores de Consumo', () => {
    it('deve ter fatores de consumo definidos', () => {
      assert.ok(CONSUMPTION_FACTORS.idle);
      assert.ok(CONSUMPTION_FACTORS.inCall);
      assert.ok(CONSUMPTION_FACTORS.muted);
    });

    it('fator em chamada deve ser maior que idle', () => {
      assert.ok(CONSUMPTION_FACTORS.inCall > CONSUMPTION_FACTORS.idle);
    });
  });
});

console.log('Testes BatteryTracker carregados');
