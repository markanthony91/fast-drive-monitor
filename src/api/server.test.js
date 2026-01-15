/**
 * Testes automatizados - API Server
 *
 * Executa: npm test
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Diretório temporário para testes
const TEST_DATA_DIR = path.join(__dirname, '../../data/test-api');
const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

// Import dinâmico para evitar inicialização automática
let ApiServer;
let server;

describe('API Server', () => {
  before(async () => {
    // Criar diretório de teste
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }

    // Importar e inicializar servidor
    const module = require('./server');
    ApiServer = module.ApiServer;

    server = new ApiServer({
      port: TEST_PORT,
      host: 'localhost',
      dataDir: TEST_DATA_DIR
    });

    await server.initialize();

    // Aguardar servidor estar pronto
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  after(async () => {
    if (server) {
      await server.shutdown();
    }

    // Aguardar fechamento
    await new Promise(resolve => setTimeout(resolve, 500));

    // Limpar diretório de teste
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe('GET /api/server-info', () => {
    it('deve retornar informações do servidor', async () => {
      const response = await fetch(`${BASE_URL}/server-info`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.hostname);
      assert.ok(data.platform);
      assert.ok(data.arch);
      assert.ok(data.nodeVersion);
      assert.ok(data.startedAt);
      assert.ok(data.uptime >= 0);
    });
  });

  describe('GET /api/state', () => {
    it('deve retornar estado do sistema', async () => {
      const response = await fetch(`${BASE_URL}/state`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.hostname);
      assert.ok(Array.isArray(data.registeredHeadsets));
      assert.ok(Array.isArray(data.activeHeadsets));
      assert.ok(Array.isArray(data.connectedDongles));
      assert.ok(data.availableColors);
    });
  });

  describe('GET /api/colors', () => {
    it('deve retornar cores disponíveis', async () => {
      const response = await fetch(`${BASE_URL}/colors`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.blue);
      assert.ok(data.yellow);
      assert.ok(data.green);
      assert.ok(data.red);
      assert.ok(data.white);
    });
  });

  describe('Headsets CRUD', () => {
    let createdHeadsetId;

    it('POST /api/headsets - deve criar headset', async () => {
      const response = await fetch(`${BASE_URL}/headsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Headset API Test',
          color: 'blue'
        })
      });
      const data = await response.json();

      assert.strictEqual(response.status, 201);
      assert.ok(data.id);
      assert.strictEqual(data.name, 'Headset API Test');
      assert.strictEqual(data.color, 'blue');
      assert.ok(data.hostname);

      createdHeadsetId = data.id;
    });

    it('GET /api/headsets - deve listar headsets', async () => {
      const response = await fetch(`${BASE_URL}/headsets`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(Array.isArray(data));
      assert.ok(data.length >= 1);
    });

    it('GET /api/headsets/:id - deve retornar headset específico', async () => {
      const response = await fetch(`${BASE_URL}/headsets/${createdHeadsetId}`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.id, createdHeadsetId);
      assert.strictEqual(data.name, 'Headset API Test');
    });

    it('PUT /api/headsets/:id - deve atualizar headset', async () => {
      const response = await fetch(`${BASE_URL}/headsets/${createdHeadsetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Headset Atualizado'
        })
      });
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(data.name, 'Headset Atualizado');
    });

    it('POST /api/headsets - deve rejeitar cor duplicada', async () => {
      const response = await fetch(`${BASE_URL}/headsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Outro Headset',
          color: 'blue' // Já em uso
        })
      });
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error.includes('já está em uso'));
    });

    it('DELETE /api/headsets/:id - deve remover headset', async () => {
      const response = await fetch(`${BASE_URL}/headsets/${createdHeadsetId}`, {
        method: 'DELETE'
      });

      assert.strictEqual(response.status, 204);
    });

    it('GET /api/headsets/:id - deve retornar 404 para headset removido', async () => {
      const response = await fetch(`${BASE_URL}/headsets/${createdHeadsetId}`);

      assert.strictEqual(response.status, 404);
    });
  });

  describe('GET /api/stats', () => {
    it('deve retornar estatísticas', async () => {
      const response = await fetch(`${BASE_URL}/stats`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.hostname);
      assert.ok(data.charging !== undefined);
      assert.ok(data.usage !== undefined);
      assert.ok(data.current !== undefined);
    });
  });

  describe('GET /api/stats/battery-history', () => {
    it('deve retornar histórico de bateria', async () => {
      const response = await fetch(`${BASE_URL}/stats/battery-history?hours=24`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.hostname);
      assert.ok(Array.isArray(data.data));
    });
  });

  describe('GET /api/stats/charging-history', () => {
    it('deve retornar histórico de carregamento', async () => {
      const response = await fetch(`${BASE_URL}/stats/charging-history?limit=10`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.hostname);
      assert.ok(Array.isArray(data.data));
    });
  });

  describe('Sistema de Updates', () => {
    it('GET /api/update/status - deve retornar status', async () => {
      const response = await fetch(`${BASE_URL}/update/status`);
      const data = await response.json();

      assert.strictEqual(response.status, 200);
      assert.ok(data.hostname);
      assert.ok(data.currentVersion !== undefined);
    });
  });

  describe('CORS', () => {
    it('deve ter headers CORS configurados', async () => {
      const response = await fetch(`${BASE_URL}/server-info`);

      assert.strictEqual(
        response.headers.get('access-control-allow-origin'),
        '*'
      );
    });

    it('deve responder OPTIONS corretamente', async () => {
      const response = await fetch(`${BASE_URL}/server-info`, {
        method: 'OPTIONS'
      });

      assert.strictEqual(response.status, 200);
    });
  });

  describe('Erros', () => {
    it('deve retornar 404 para rota inexistente', async () => {
      const response = await fetch(`${BASE_URL}/rota-inexistente`);

      assert.strictEqual(response.status, 404);
    });

    it('deve retornar 400 para dados inválidos', async () => {
      const response = await fetch(`${BASE_URL}/headsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Teste',
          color: 'cor-invalida'
        })
      });
      const data = await response.json();

      assert.strictEqual(response.status, 400);
      assert.ok(data.error);
    });
  });
});

console.log('Testes API Server carregados');
