/**
 * Testes automatizados - HeadsetManager
 *
 * Executa: npm test
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { HeadsetManager, HEADSET_COLORS } = require('./headsetManager');

// Diretório temporário para testes
const TEST_DATA_DIR = path.join(__dirname, '../data/test');

describe('HeadsetManager', () => {
  let manager;

  before(() => {
    // Criar diretório de teste
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Limpar banco de dados de teste
    const dbPath = path.join(TEST_DATA_DIR, 'headsets.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Criar nova instância
    manager = new HeadsetManager({
      dataDir: TEST_DATA_DIR,
      hostname: 'test-host'
    });
    await manager.initialize();
  });

  after(async () => {
    // Limpar após todos os testes
    if (manager) {
      await manager.shutdown();
    }

    // Remover diretório de teste
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe('Inicialização', () => {
    it('deve inicializar corretamente', async () => {
      assert.ok(manager.db, 'Banco de dados deve estar conectado');
      assert.strictEqual(manager.registeredHeadsets.size, 0, 'Deve iniciar sem headsets');
    });

    it('deve ter hostname configurado', () => {
      assert.strictEqual(manager.options.hostname, 'test-host');
    });
  });

  describe('Registro de Headsets', () => {
    it('deve registrar um novo headset', () => {
      const headset = manager.registerHeadset({
        name: 'Headset Teste',
        color: 'blue'
      });

      assert.ok(headset.id, 'Deve gerar ID');
      assert.strictEqual(headset.name, 'Headset Teste');
      assert.strictEqual(headset.color, 'blue');
      assert.strictEqual(headset.hostname, 'test-host');
      assert.strictEqual(manager.registeredHeadsets.size, 1);
    });

    it('deve atribuir cor automaticamente se não especificada', () => {
      const headset = manager.registerHeadset({
        name: 'Headset Auto'
      });

      assert.ok(HEADSET_COLORS[headset.color], 'Deve ter cor válida');
    });

    it('deve atribuir número sequencial', () => {
      const h1 = manager.registerHeadset({ name: 'H1', color: 'blue' });
      const h2 = manager.registerHeadset({ name: 'H2', color: 'yellow' });
      const h3 = manager.registerHeadset({ name: 'H3', color: 'green' });

      assert.strictEqual(h1.number, 1);
      assert.strictEqual(h2.number, 2);
      assert.strictEqual(h3.number, 3);
    });
  });

  describe('Validação de Cor Exclusiva', () => {
    it('deve rejeitar cor duplicada', () => {
      manager.registerHeadset({ name: 'H1', color: 'blue' });

      assert.throws(() => {
        manager.registerHeadset({ name: 'H2', color: 'blue' });
      }, /já está em uso/);
    });

    it('deve sugerir próxima cor disponível no erro', () => {
      manager.registerHeadset({ name: 'H1', color: 'blue' });

      try {
        manager.registerHeadset({ name: 'H2', color: 'blue' });
        assert.fail('Deveria lançar erro');
      } catch (error) {
        assert.ok(error.message.includes('Próxima cor disponível'),
          'Deve sugerir próxima cor');
      }
    });

    it('deve permitir até 5 headsets (um de cada cor)', () => {
      const colors = Object.keys(HEADSET_COLORS);

      colors.forEach((color, index) => {
        const headset = manager.registerHeadset({
          name: `Headset ${index + 1}`,
          color
        });
        assert.strictEqual(headset.color, color);
      });

      assert.strictEqual(manager.registeredHeadsets.size, 5);
    });

    it('deve rejeitar 6º headset (todas as cores em uso)', () => {
      const colors = Object.keys(HEADSET_COLORS);

      // Registrar 5 headsets
      colors.forEach((color, index) => {
        manager.registerHeadset({ name: `H${index}`, color });
      });

      // Tentar registrar 6º
      assert.throws(() => {
        manager.registerHeadset({ name: 'H6' });
      }, /Todas as cores já estão em uso|Limite máximo/);
    });

    it('deve rejeitar cor inválida', () => {
      assert.throws(() => {
        manager.registerHeadset({ name: 'H1', color: 'roxo' });
      }, /Cor inválida/);
    });
  });

  describe('Validação de ID Exclusivo', () => {
    it('deve rejeitar ID duplicado', () => {
      manager.registerHeadset({ id: 'hs_123', name: 'H1', color: 'blue' });

      assert.throws(() => {
        manager.registerHeadset({ id: 'hs_123', name: 'H2', color: 'yellow' });
      }, /já está em uso/);
    });

    it('deve gerar ID único automaticamente', () => {
      const h1 = manager.registerHeadset({ name: 'H1', color: 'blue' });
      const h2 = manager.registerHeadset({ name: 'H2', color: 'yellow' });

      assert.notStrictEqual(h1.id, h2.id, 'IDs devem ser diferentes');
    });
  });

  describe('Validação de Serial Number', () => {
    it('deve rejeitar serial number duplicado', () => {
      manager.registerHeadset({
        name: 'H1',
        color: 'blue',
        serialNumber: 'SN123456'
      });

      assert.throws(() => {
        manager.registerHeadset({
          name: 'H2',
          color: 'yellow',
          serialNumber: 'SN123456'
        });
      }, /Serial number.*já está em uso/);
    });

    it('deve permitir serial number null/undefined', () => {
      const h1 = manager.registerHeadset({ name: 'H1', color: 'blue' });
      const h2 = manager.registerHeadset({ name: 'H2', color: 'yellow' });

      assert.strictEqual(h1.serialNumber, null);
      assert.strictEqual(h2.serialNumber, null);
    });
  });

  describe('Atualização de Headsets', () => {
    it('deve atualizar nome do headset', () => {
      const headset = manager.registerHeadset({ name: 'Original', color: 'blue' });
      const updated = manager.updateHeadset(headset.id, { name: 'Novo Nome' });

      assert.strictEqual(updated.name, 'Novo Nome');
      assert.strictEqual(updated.color, 'blue'); // Cor mantida
    });

    it('deve permitir trocar para cor disponível', () => {
      const h1 = manager.registerHeadset({ name: 'H1', color: 'blue' });

      const updated = manager.updateHeadset(h1.id, { color: 'yellow' });

      assert.strictEqual(updated.color, 'yellow');
    });

    it('deve rejeitar troca para cor em uso por outro headset', () => {
      manager.registerHeadset({ name: 'H1', color: 'blue' });
      const h2 = manager.registerHeadset({ name: 'H2', color: 'yellow' });

      assert.throws(() => {
        manager.updateHeadset(h2.id, { color: 'blue' });
      }, /já está em uso/);
    });

    it('deve permitir manter a mesma cor na atualização', () => {
      const h1 = manager.registerHeadset({ name: 'H1', color: 'blue' });

      // Atualizar nome mantendo cor
      const updated = manager.updateHeadset(h1.id, {
        name: 'Novo Nome',
        color: 'blue'
      });

      assert.strictEqual(updated.color, 'blue');
      assert.strictEqual(updated.name, 'Novo Nome');
    });

    it('deve rejeitar atualização de headset inexistente', () => {
      assert.throws(() => {
        manager.updateHeadset('id_inexistente', { name: 'Teste' });
      }, /não encontrado/);
    });
  });

  describe('Remoção de Headsets', () => {
    it('deve remover headset existente', () => {
      const headset = manager.registerHeadset({ name: 'H1', color: 'blue' });

      manager.removeHeadset(headset.id);

      assert.strictEqual(manager.registeredHeadsets.size, 0);
    });

    it('deve liberar cor após remoção', () => {
      const h1 = manager.registerHeadset({ name: 'H1', color: 'blue' });
      manager.removeHeadset(h1.id);

      // Deve poder usar azul novamente
      const h2 = manager.registerHeadset({ name: 'H2', color: 'blue' });
      assert.strictEqual(h2.color, 'blue');
    });

    it('deve rejeitar remoção de headset inexistente', () => {
      assert.throws(() => {
        manager.removeHeadset('id_inexistente');
      }, /não encontrado/);
    });
  });

  describe('Métodos de Consulta', () => {
    beforeEach(() => {
      manager.registerHeadset({ name: 'H1', color: 'blue' });
      manager.registerHeadset({ name: 'H2', color: 'yellow' });
    });

    it('deve retornar lista de headsets registrados', () => {
      const headsets = manager.getRegisteredHeadsets();

      assert.strictEqual(headsets.length, 2);
      assert.ok(headsets.every(h => h.hostname === 'test-host'));
    });

    it('deve verificar cor em uso corretamente', () => {
      assert.ok(manager.isColorInUse('blue').inUse);
      assert.ok(manager.isColorInUse('yellow').inUse);
      assert.ok(!manager.isColorInUse('green').inUse);
    });

    it('deve retornar próxima cor disponível', () => {
      const nextColor = manager.getNextAvailableColor();

      assert.ok(nextColor);
      assert.ok(!manager.isColorInUse(nextColor).inUse);
    });

    it('deve retornar estado do sistema com hostname', () => {
      const state = manager.getSystemState();

      assert.strictEqual(state.hostname, 'test-host');
      assert.ok(Array.isArray(state.registeredHeadsets));
      assert.ok(state.availableColors);
    });
  });

  describe('Persistência', () => {
    it('deve persistir headsets no banco de dados', async () => {
      manager.registerHeadset({ name: 'Persistido', color: 'blue' });

      // Fechar e reabrir
      await manager.shutdown();

      manager = new HeadsetManager({
        dataDir: TEST_DATA_DIR,
        hostname: 'test-host'
      });
      await manager.initialize();

      const headsets = manager.getRegisteredHeadsets();
      assert.strictEqual(headsets.length, 1);
      assert.strictEqual(headsets[0].name, 'Persistido');
    });
  });
});

console.log('Testes HeadsetManager carregados');
