# Fast Drive - Jabra Engage 55 Mono Monitor

> Sistema de monitoramento de headsets Jabra Engage 55 Mono com API REST, WebSocket e interface web.

**Versão:** 2.8.0

**Última atualização:** 2026-01-16

**Status:** Em desenvolvimento


---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Instalação](#instalação)
4. [Uso](#uso)
5. [API REST](#api-rest)
6. [Exemplos de Resposta JSON](#exemplos-de-resposta-json)
7. [WebSocket](#websocket)
8. [Testando com cURL](#testando-com-curl)
9. [Testes Automatizados](#testes-automatizados)
10. [Sistema de Atualização](#sistema-de-atualização)
11. [Coexistência com Aplicações C#](#coexistência-com-aplicações-c)
12. [Configuração Nix](#configuração-nix)
13. [Banco de Dados](#banco-de-dados)
14. [Deploy no Windows](#deploy-no-windows)
15. [Arquitetura](#arquitetura)
16. [Contribuindo](#contribuindo)
17. [Estatísticas do Projeto](#estatísticas-do-projeto)
18. [Changelog](#changelog)

---

## Visão Geral

**Fast Drive** é uma aplicação para monitoramento de headsets **Jabra Engage 55 Mono**, desenvolvida em Node.js com:

- **API REST** para integração com sistemas externos
- **WebSocket** para atualizações em tempo real
- **Interface Web** minimalista e responsiva
- **Electron** para aplicação desktop multiplataforma
- **SQLite** para persistência de dados
- **Hostname** em todos os registros para identificação da origem

---

## Funcionalidades

| Funcionalidade | Descrição | Status |
|----------------|-----------|--------|
| Conexão USB | Detecta e conecta ao headset via SDK Jabra | ✅ |
| Nível de Bateria | Exibe percentual atual da bateria | ✅ |
| Status Carregamento | Detecta quando está carregando | ✅ |
| Tempo para Carga | Estima tempo até 100% | ✅ |
| Autonomia | Estima duração da bateria | ✅ |
| Status de Chamada | Detecta se está em chamada | ✅ |
| Status de Mudo | Detecta se microfone está mudo | ✅ |
| Múltiplos Headsets | Gerencia vários headsets com cores e números | ✅ |
| API REST | Endpoints para integração externa | ✅ |
| WebSocket | Atualizações em tempo real | ✅ |
| Hostname | Identificação do servidor em todos os dados | ✅ |
| Histórico | Persiste dados em SQLite | ✅ |
| Interface Web | UI responsiva dark mode | ✅ |
| Interface Electron | App desktop multiplataforma | ✅ |
| Alerta Bateria Baixa | Toast e som quando bateria < 20% | ✅ |
| Sparkline de Bateria | Mini gráfico do histórico de bateria | ✅ |
| Tema Claro/Escuro | Toggle de tema com persistência | ✅ |
| Exportar Dados | Export para JSON ou CSV | ✅ |
| Sistema de Logs | Persistência de eventos em SQLite | ✅ |
| Tracking de Dongle | Detecta desconexão física vs perda de sinal | ✅ |
| Histórico de Sessões | Registra sessões de uso do headset | ✅ |

---

## Instalação

### Pré-requisitos

- Node.js 18+ (recomendado: 20)
- npm ou yarn
- Nix (opcional, recomendado para Linux)

### Via npm

```bash
cd projeto_fast_drive
npm install
```

### Via Nix (Linux - Recomendado)

```bash
cd projeto_fast_drive

# Com Flakes
nix --experimental-features 'nix-command flakes' develop

# Ou método tradicional
nix-shell

# Instalar dependências
npm install
```

### Permissões USB (Linux)

```bash
sudo cp udev/99-jabra.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
sudo usermod -aG plugdev $USER
# Faça logout/login após este comando
```

---

## Uso

### Servidor Web (Recomendado)

```bash
npm start
# Acesse: http://localhost:18080
```

### Modo CLI

```bash
npm run start:cli
```

### Modo Electron (Desktop)

```bash
npm run electron
```

### Modo Desenvolvimento

```bash
# Servidor com hot-reload
npm run dev

# Electron com DevTools
npm run electron:dev
```

---

## API REST

Base URL: `http://localhost:18080/api`

### Endpoints Disponíveis

#### Informações do Servidor

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/server-info` | Informações do servidor (hostname, platform, uptime) |

#### Estado do Sistema

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/state` | Estado completo (headsets, dongles, cores) |

#### Headsets

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/headsets` | Lista todos os headsets registrados |
| GET | `/api/headsets/:id` | Obtém headset específico |
| GET | `/api/headsets/active` | Lista headsets atualmente ligados |
| POST | `/api/headsets` | Registra novo headset |
| PUT | `/api/headsets/:id` | Atualiza headset |
| DELETE | `/api/headsets/:id` | Remove headset |

#### Dongles

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/dongles` | Lista dongles conectados |

#### Cores

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/colors` | Lista cores disponíveis para headsets |

#### Estatísticas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/stats` | Estatísticas completas de uso |
| GET | `/api/stats/battery-history?hours=24` | Histórico de bateria (últimas N horas) |
| GET | `/api/stats/charging-history?limit=50` | Histórico de sessões de carregamento |

#### Sistema de Updates

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/update/status` | Status do sistema de atualizações |
| POST | `/api/update/check` | Verificar se há atualizações disponíveis |
| POST | `/api/update/apply` | Aplicar atualização (git pull + npm install) |
| POST | `/api/update/restart` | Reiniciar o serviço após atualização |

#### Sistema de Logs (v2.8.0)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/logs` | Consulta logs com filtros (type, severity, headsetId, dongleId, startTime, endTime) |
| GET | `/api/logs/stats` | Estatísticas agregadas de eventos |
| GET | `/api/logs/dongles` | Histórico de conexões de dongle USB |
| GET | `/api/logs/sessions` | Sessões de uso do headset (duração, bateria) |
| GET | `/api/logs/types` | Tipos de eventos disponíveis |

---

## Exemplos de Resposta JSON

### GET /api/server-info

```json
{
  "hostname": "pc-atendimento-01",
  "platform": "win32",
  "arch": "x64",
  "nodeVersion": "v20.19.6",
  "startedAt": 1768502117582,
  "uptime": 3600
}
```

### GET /api/state

```json
{
  "hostname": "pc-atendimento-01",
  "registeredHeadsets": [
    {
      "id": "hs_1705312800000_abc123",
      "hostname": "pc-atendimento-01",
      "name": "Headset Marcelo",
      "color": "blue",
      "number": 1,
      "serialNumber": "SN123456789",
      "createdAt": 1705312800000,
      "updatedAt": 1705312800000
    }
  ],
  "activeHeadsets": [
    {
      "id": "hs_1705312800000_abc123",
      "name": "Headset Marcelo",
      "color": "blue",
      "batteryLevel": 85,
      "isCharging": false,
      "isInCall": true,
      "isMuted": false,
      "connected": true
    }
  ],
  "connectedDongles": [
    {
      "id": "dongle_001",
      "hostname": "pc-atendimento-01",
      "productName": "Jabra Engage 55 Mono",
      "vendorId": 2830,
      "productId": 5
    }
  ],
  "availableColors": {
    "yellow": true,
    "green": true,
    "red": true,
    "white": true
  }
}
```

### GET /api/headsets

```json
[
  {
    "id": "hs_1705312800000_abc123",
    "hostname": "pc-atendimento-01",
    "name": "Headset Marcelo",
    "color": "blue",
    "number": 1,
    "serialNumber": "SN123456789",
    "createdAt": 1705312800000,
    "updatedAt": 1705312800000
  },
  {
    "id": "hs_1705312900000_def456",
    "hostname": "pc-atendimento-01",
    "name": "Headset João",
    "color": "yellow",
    "number": 2,
    "serialNumber": null,
    "createdAt": 1705312900000,
    "updatedAt": 1705312900000
  }
]
```

### POST /api/headsets (Criar)

**Request:**
```json
{
  "name": "Headset Maria",
  "color": "green"
}
```

**Response (201 Created):**
```json
{
  "id": "hs_1705313000000_ghi789",
  "hostname": "pc-atendimento-01",
  "name": "Headset Maria",
  "color": "green",
  "number": 3,
  "serialNumber": null,
  "createdAt": 1705313000000,
  "updatedAt": 1705313000000
}
```

**Response (400 Bad Request - Cor duplicada):**
```json
{
  "error": "Cor 'blue' já está em uso pelo headset 'Headset Marcelo'. Próxima cor disponível: yellow"
}
```

### GET /api/colors

```json
{
  "blue": {
    "name": "Azul",
    "hex": "#3B82F6",
    "inUse": true,
    "headset": "Headset Marcelo"
  },
  "yellow": {
    "name": "Amarelo",
    "hex": "#EAB308",
    "inUse": false
  },
  "green": {
    "name": "Verde",
    "hex": "#22C55E",
    "inUse": false
  },
  "red": {
    "name": "Vermelho",
    "hex": "#EF4444",
    "inUse": false
  },
  "white": {
    "name": "Branco",
    "hex": "#F8FAFC",
    "inUse": false
  }
}
```

### GET /api/stats

```json
{
  "hostname": "pc-atendimento-01",
  "charging": {
    "totalSessions": 45,
    "averageDuration": 62.5,
    "averageStartLevel": 25,
    "averageEndLevel": 98,
    "lastSession": {
      "startTime": 1705312800000,
      "endTime": 1705316400000,
      "startLevel": 20,
      "endLevel": 100,
      "durationMinutes": 60
    }
  },
  "usage": {
    "totalCallMinutes": 1250,
    "averageCallDuration": 8.5,
    "totalCalls": 147,
    "muteUsagePercent": 12.3
  },
  "current": {
    "batteryLevel": 85,
    "isCharging": false,
    "isInCall": true,
    "isMuted": false,
    "estimatedTimeToEmpty": 420,
    "estimatedTimeToFull": null
  }
}
```

### GET /api/stats/battery-history?hours=24

```json
{
  "hostname": "pc-atendimento-01",
  "period": {
    "hours": 24,
    "from": 1705226400000,
    "to": 1705312800000
  },
  "data": [
    {
      "timestamp": 1705226400000,
      "batteryLevel": 100,
      "isCharging": false,
      "isInCall": false,
      "isMuted": false
    },
    {
      "timestamp": 1705230000000,
      "batteryLevel": 95,
      "isCharging": false,
      "isInCall": true,
      "isMuted": false
    }
  ]
}
```

### GET /api/stats/charging-history?limit=10

```json
{
  "hostname": "pc-atendimento-01",
  "data": [
    {
      "id": 45,
      "hostname": "pc-atendimento-01",
      "startTime": 1705312800000,
      "endTime": 1705316400000,
      "startLevel": 20,
      "endLevel": 100,
      "durationMinutes": 60,
      "chargingRate": 1.33
    },
    {
      "id": 44,
      "hostname": "pc-atendimento-01",
      "startTime": 1705226400000,
      "endTime": 1705230000000,
      "startLevel": 15,
      "endLevel": 100,
      "durationMinutes": 60,
      "chargingRate": 1.42
    }
  ]
}
```

### GET /api/update/status

```json
{
  "hostname": "pc-atendimento-01",
  "currentVersion": "2.3.0",
  "updateInProgress": false,
  "lastCheck": 1705312800000,
  "repoDir": "C:\\fast-drive",
  "branch": "main",
  "remote": "origin"
}
```

### POST /api/update/check

```json
{
  "hostname": "pc-atendimento-01",
  "available": true,
  "currentCommit": "abc1234",
  "remoteCommit": "def5678",
  "behind": 3,
  "changes": [
    "fix: Corrigir bug de conexão",
    "feat: Adicionar novo endpoint",
    "docs: Atualizar documentação"
  ]
}
```

### POST /api/update/apply

```json
{
  "hostname": "pc-atendimento-01",
  "success": true,
  "previousVersion": "2.2.0",
  "newVersion": "2.3.0",
  "updatedAt": 1705312800000,
  "restartRequired": true,
  "message": "Atualização aplicada com sucesso. Reinicie o serviço."
}
```

### GET /api/logs

**Parâmetros de Query:**
- `limit` (default: 100) - Quantidade de registros
- `offset` (default: 0) - Paginação
- `type` - Tipo de evento (dongle_connected, headset_turned_on, etc.)
- `severity` - Severidade (info, warning, error, critical)
- `headsetId` - Filtrar por headset
- `dongleId` - Filtrar por dongle
- `startTime` - Timestamp inicial
- `endTime` - Timestamp final

```json
{
  "hostname": "pc-atendimento-01",
  "data": [
    {
      "id": 145,
      "hostname": "pc-atendimento-01",
      "eventType": "headset_turned_on",
      "severity": "info",
      "timestamp": 1705312800000,
      "headsetId": "hs_123456789",
      "headsetName": "Headset Marcelo",
      "dongleId": "5",
      "message": "Headset ligado",
      "metadata": "{\"batteryLevel\":85}"
    },
    {
      "id": 144,
      "hostname": "pc-atendimento-01",
      "eventType": "dongle_connected",
      "severity": "info",
      "timestamp": 1705312750000,
      "dongleId": "5",
      "message": "Dongle USB conectado",
      "metadata": "{\"dongleName\":\"Jabra Engage 55 USB Dongle\"}"
    }
  ]
}
```

### GET /api/logs/stats

```json
{
  "hostname": "pc-atendimento-01",
  "data": {
    "totalEvents": 1250,
    "byType": {
      "headset_turned_on": 145,
      "headset_turned_off": 142,
      "dongle_connected": 48,
      "dongle_disconnected": 45,
      "battery_low": 23,
      "charging_started": 89,
      "charging_stopped": 87
    },
    "bySeverity": {
      "info": 1180,
      "warning": 45,
      "error": 20,
      "critical": 5
    },
    "lastEvent": 1705312800000
  }
}
```

### GET /api/logs/dongles

```json
{
  "hostname": "pc-atendimento-01",
  "data": [
    {
      "id": 48,
      "hostname": "pc-atendimento-01",
      "dongleId": "5",
      "dongleName": "Jabra Engage 55 USB Dongle",
      "connectedAt": 1705312750000,
      "disconnectedAt": 1705320000000,
      "disconnectReason": "usb_removed",
      "sessionDuration": 7250000,
      "metadata": "{\"reason\":\"Dongle USB removido fisicamente\"}"
    }
  ]
}
```

### GET /api/logs/sessions

```json
{
  "hostname": "pc-atendimento-01",
  "data": [
    {
      "id": 142,
      "hostname": "pc-atendimento-01",
      "headsetId": "hs_123456789",
      "headsetName": "Headset Marcelo",
      "startTime": 1705312800000,
      "endTime": 1705320000000,
      "startBattery": 85,
      "endBattery": 45,
      "disconnectReason": "normal",
      "sessionDuration": 7200000,
      "metadata": null
    }
  ]
}
```

### GET /api/logs/types

```json
{
  "hostname": "pc-atendimento-01",
  "data": [
    "dongle_connected",
    "dongle_disconnected",
    "dongle_error",
    "headset_turned_on",
    "headset_turned_off",
    "battery_low",
    "battery_critical",
    "charging_started",
    "charging_stopped",
    "call_started",
    "call_ended",
    "mute_changed",
    "connection_lost",
    "connection_restored"
  ]
}
```

---

## WebSocket

Conecte em: `ws://localhost:18080/ws`

### Eventos Recebidos

```javascript
// Estrutura das mensagens
{
  "type": "evento",
  "data": { ... },
  "hostname": "nome-do-servidor",
  "timestamp": 1234567890
}
```

| Evento | Descrição |
|--------|-----------|
| `init` | Estado inicial ao conectar (inclui serverInfo) |
| `headsetRegistered` | Novo headset registrado |
| `headsetUpdated` | Headset atualizado |
| `headsetRemoved` | Headset removido |
| `headsetTurnedOn` | Headset ligado |
| `headsetTurnedOff` | Headset desligado |
| `headsetStateUpdated` | Estado do headset alterado (bateria, chamada, mudo) |
| `dongleConnected` | Dongle conectado |
| `dongleDisconnected` | Dongle desconectado |

### Exemplo de Conexão

```javascript
const ws = new WebSocket('ws://localhost:18080/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(`[${message.hostname}] ${message.type}:`, message.data);
};
```

---

## Testando com cURL

### Informações do Servidor

```bash
curl http://localhost:18080/api/server-info
```

Resposta:
```json
{
  "hostname": "fedora",
  "platform": "linux",
  "arch": "x64",
  "nodeVersion": "v20.19.6",
  "startedAt": 1768502117582,
  "uptime": 12345
}
```

### Estado Completo do Sistema

```bash
curl http://localhost:18080/api/state
```

### Listar Headsets

```bash
curl http://localhost:18080/api/headsets
```

### Obter Headset Específico

```bash
curl http://localhost:18080/api/headsets/hs_123456789
```

### Registrar Novo Headset

```bash
curl -X POST http://localhost:18080/api/headsets \
  -H "Content-Type: application/json" \
  -d '{"name": "Headset Marcelo", "color": "blue", "number": 1}'
```

### Atualizar Headset

```bash
curl -X PUT http://localhost:18080/api/headsets/hs_123456789 \
  -H "Content-Type: application/json" \
  -d '{"name": "Novo Nome", "color": "green"}'
```

### Remover Headset

```bash
curl -X DELETE http://localhost:18080/api/headsets/hs_123456789
```

### Listar Dongles Conectados

```bash
curl http://localhost:18080/api/dongles
```

### Cores Disponíveis

```bash
curl http://localhost:18080/api/colors
```

### Estatísticas Completas

```bash
curl http://localhost:18080/api/stats
```

### Histórico de Bateria (últimas 24 horas)

```bash
curl "http://localhost:18080/api/stats/battery-history?hours=24"
```

### Histórico de Carregamento

```bash
curl "http://localhost:18080/api/stats/charging-history?limit=10"
```

### Testar WebSocket com websocat

```bash
# Instalar websocat
# Fedora: sudo dnf install websocat
# Ubuntu: sudo apt install websocat

websocat ws://localhost:18080/ws
```

---

## Testes Automatizados

O projeto inclui uma suite completa de testes automatizados usando o módulo nativo `node:test`.

### Executar Todos os Testes

```bash
# Via npm (recompila better-sqlite3 primeiro)
npm test

# Via Nix
nix-shell --run "npm test"
```

### Executar Testes Individuais

```bash
# HeadsetManager (27 testes)
node --test src/headsetManager.test.js

# BatteryTracker (21 testes)
node --test src/batteryTracker.test.js

# API Server (19 testes)
node --test src/api/server.test.js

# UpdateManager (12 testes)
node --test src/updateManager.test.js
```

### Cobertura dos Testes

| Módulo | Testes | Cobertura |
|--------|--------|-----------|
| HeadsetManager | 27 | Inicialização, CRUD, validação de cor/ID/serial, persistência |
| BatteryTracker | 21 | Bateria, carregamento, chamada/mudo, estimativas, histórico |
| API Server | 19 | Endpoints REST, CORS, erros, CRUD headsets |
| UpdateManager | 12 | Inicialização, verificação, aplicação de updates |

---

## Sistema de Atualização

O Fast Drive inclui um sistema de atualização automática baseado em Git, permitindo atualizar múltiplas máquinas de forma centralizada.

### Como Funciona

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE ATUALIZAÇÃO                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. VERIFICAR                                                        │
│     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│     │   Máquina   │────▶│  git fetch  │────▶│  Comparar   │        │
│     │   Local     │     │   origin    │     │   commits   │        │
│     └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                    │                 │
│                                                    ▼                 │
│  2. APLICAR (se houver atualizações)                                │
│     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│     │  git pull   │────▶│ npm install │────▶│   Reiniciar │        │
│     │   origin    │     │ (se needed) │     │   serviço   │        │
│     └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Endpoints da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/update/status` | GET | Status atual do sistema |
| `/api/update/check` | POST | Verificar atualizações disponíveis |
| `/api/update/apply` | POST | Baixar e aplicar atualização |
| `/api/update/restart` | POST | Reiniciar o serviço |

### Exemplo de Uso

```bash
# 1. Verificar se há atualizações
curl -X POST http://localhost:18080/api/update/check

# Resposta: {"available": true, "behind": 3, "changes": [...]}

# 2. Aplicar atualização
curl -X POST http://localhost:18080/api/update/apply

# Resposta: {"success": true, "restartRequired": true}

# 3. Reiniciar serviço (Windows com NSSM)
curl -X POST http://localhost:18080/api/update/restart
```

### Atualização em Massa

Para atualizar múltiplas máquinas, use o script PowerShell incluído:

```powershell
# Criar arquivo hosts.txt com lista de máquinas
# pc-atendimento-01
# pc-atendimento-02
# 192.168.1.100

# Executar atualização em massa
.\scripts\update-all.ps1 -HostsFile hosts.txt
```

O script:
1. Lê lista de hosts do arquivo
2. Para cada host, verifica atualizações via API
3. Aplica atualizações onde necessário
4. Reinicia serviços
5. Gera relatório de sucesso/falha

### Configuração do UpdateManager

```javascript
const updateManager = new UpdateManager({
  repoDir: 'C:\\fast-drive',  // Diretório do repositório
  branch: 'main',              // Branch a seguir
  remote: 'origin',            // Remote git
  autoRestart: false           // Reinício automático após update
});
```

---

## Coexistência com Aplicações C#

### A API Jabra compete com outras aplicações?

**Resposta curta:** Não necessariamente, mas requer configuração adequada.

### Como funciona a coexistência

O Jabra SDK foi projetado para permitir que **múltiplos softphones** usem o mesmo headset simultaneamente sem conflitos:

> "The SDK ensures that multiple softphones can have Jabra call control integrations co-exist without conflicts."
> — [Jabra Developer Documentation](https://developer.jabra.com/sdks-and-tools/javascript)

### Requisitos para Coexistência

#### 1. Partner Key (Recomendado)

Para garantir interoperabilidade, obtenha uma **Partner Key** no [Jabra Developer Portal](https://developer.jabra.com/):

```javascript
// Fast Drive (Node.js)
const api = await createApi({
  partnerKey: 'sua-partner-key',
  appId: 'fast-drive-monitor',
  appName: 'Fast Drive'
});
```

```csharp
// Sua aplicação C#
var sdk = await JabraSdk.CreateAsync(new SdkConfig {
    PartnerKey = "sua-partner-key",
    AppId = "sua-aplicacao",
    AppName = "Sua Aplicação"
});
```

#### 2. Jabra Device Connector (Recomendado para Windows)

Para melhor coexistência, instale o **Jabra Device Connector**:

1. Baixe em [jabra.com/software](https://www.jabra.com/software)
2. Instale no Windows
3. O Connector gerencia o acesso ao dispositivo entre aplicações

### Modos de Transporte

| Modo | Coexistência | Recomendação |
|------|--------------|--------------|
| **Native (Node.js)** | ✅ Boa | Produção |
| **Chrome Extension** | ✅ Excelente | Browser apps |
| **WebHID** | ⚠️ Limitada | Desenvolvimento |

### Cenário: Fast Drive + Softphone C#

```
┌──────────────────────────────────────────────────────────────────┐
│                         WINDOWS                                   │
│                                                                   │
│  ┌─────────────────┐        ┌─────────────────┐                 │
│  │   Fast Drive    │        │  Softphone C#   │                 │
│  │   (Node.js)     │        │  (.NET SDK)     │                 │
│  │   Port 18080    │        │  Sua aplicação  │                 │
│  └────────┬────────┘        └────────┬────────┘                 │
│           │                          │                           │
│           ▼                          ▼                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Jabra Device Connector                        │  │
│  │         (Gerencia acesso ao dispositivo)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Jabra Engage 55 Mono (USB)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Recomendações

1. **Use Partner Keys** em ambas as aplicações
2. **Instale o Jabra Device Connector** no Windows
3. **Evite polling agressivo** - use eventos quando possível
4. **Fast Drive é passivo** - apenas monitora, não controla chamadas
5. **Teste a integração** antes de deploy em produção

### Referências

- [Jabra JavaScript SDK](https://developer.jabra.com/sdks-and-tools/javascript)
- [Jabra .NET SDK](https://developer.jabra.com/sdks-and-tools/dotnet)
- [Obter Partner Key](https://developer.jabra.com/support/)

---

## Deploy no Windows

### Opção 1: Electron (Recomendado para Usuários Finais)

**Vantagens:**
- Interface gráfica nativa
- Instalador fácil (NSIS)
- Ícone na bandeja do sistema
- Atualizações automáticas possíveis

**Desvantagens:**
- Maior consumo de recursos
- Requer interação do usuário para iniciar

```bash
# Build para Windows
npm run build:win

# Gera: dist/Fast Drive - Jabra Monitor Setup.exe
```

### Opção 2: NSSM - Serviço Windows (Recomendado para Servidores)

**Vantagens:**
- Executa como serviço do Windows
- Inicia automaticamente com o sistema
- Não precisa de usuário logado
- Baixo consumo de recursos
- Reinício automático em caso de falha

**Desvantagens:**
- Requer configuração manual
- Sem interface gráfica

**Instalação:**

1. Baixe o NSSM: https://nssm.cc/download
2. Extraia e coloque em `C:\nssm\`
3. Execute como Administrador:

```cmd
# Instalar o serviço
C:\nssm\nssm.exe install FastDriveMonitor

# Na interface que abrir:
# Path: C:\Program Files\nodejs\node.exe
# Startup directory: C:\fast-drive
# Arguments: src/api/server.js

# Ou via linha de comando:
C:\nssm\nssm.exe install FastDriveMonitor "C:\Program Files\nodejs\node.exe" "src/api/server.js"
C:\nssm\nssm.exe set FastDriveMonitor AppDirectory "C:\fast-drive"
C:\nssm\nssm.exe set FastDriveMonitor DisplayName "Fast Drive Jabra Monitor"
C:\nssm\nssm.exe set FastDriveMonitor Description "Monitor de headsets Jabra"
C:\nssm\nssm.exe set FastDriveMonitor Start SERVICE_AUTO_START

# Iniciar o serviço
C:\nssm\nssm.exe start FastDriveMonitor
```

### Opção 3: Docker (Recomendado para Ambientes Containerizados)

**Vantagens:**
- Ambiente isolado e reproduzível
- Fácil deploy em servidores
- Portabilidade entre sistemas
- Integração com Kubernetes/Docker Swarm

**Desvantagens:**
- Acesso USB complicado (requer --privileged ou mapeamento de dispositivos)
- Overhead de virtualização
- Complexidade adicional

**Dockerfile:**

```dockerfile
FROM node:20-slim

WORKDIR /app

# Dependências para USB/HID
RUN apt-get update && apt-get install -y \
    libusb-1.0-0 \
    libudev1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 18080

CMD ["node", "src/api/server.js"]
```

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  fast-drive:
    build: .
    ports:
      - "18080:18080"
    volumes:
      - ./data:/app/data
    # Para acesso USB (requer configuração adicional)
    privileged: true
    devices:
      - /dev/bus/usb:/dev/bus/usb
    restart: unless-stopped
```

### Recomendação Final

| Cenário | Recomendação |
|---------|--------------|
| Usuário final com interface | **Electron** |
| Servidor Windows dedicado | **NSSM** |
| Ambiente containerizado/cloud | **Docker** |
| Múltiplas máquinas Windows | **NSSM** + script de instalação |

Para o seu caso de **extrair dados para datalake**, recomendo **NSSM** porque:
1. Roda como serviço sem necessidade de usuário logado
2. API REST sempre disponível para consultas
3. Baixo consumo de recursos
4. Reinício automático em caso de falha
5. Fácil de configurar em múltiplas máquinas

---

## Configuração Nix

### Arquivos Nix Disponíveis

| Arquivo | Tipo | Uso |
|---------|------|-----|
| `flake.nix` | Nix Flake | Método moderno (recomendado) |
| `shell.nix` | Nix Shell | Método tradicional |

### Entrar no Ambiente

```bash
# Com Flakes (recomendado)
nix --experimental-features 'nix-command flakes' develop

# Tradicional
nix-shell
```

### Dependências Incluídas

- **Runtime**: Node.js 20, npm, yarn
- **Desktop**: Electron
- **USB/HID**: libusb1, hidapi, udev
- **Build**: gcc, make, pkg-config, python3.11
- **Gráficas**: Mesa, libGL, GTK3, X11

---

## Banco de Dados

Localização: `data/battery_tracker.db` e `data/headsets.db`

### Tabelas Principais

#### headsets
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | TEXT | PK |
| hostname | TEXT | Servidor de origem |
| serial_number | TEXT | Número de série |
| name | TEXT | Nome do headset |
| color | TEXT | Cor (blue, yellow, green, red, white) |
| number | INTEGER | Número identificador |

#### battery_history
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| hostname | TEXT | Servidor de origem |
| timestamp | INTEGER | Momento da leitura |
| battery_level | INTEGER | Nível da bateria |
| is_charging | INTEGER | Carregando? (0/1) |
| is_in_call | INTEGER | Em chamada? (0/1) |
| is_muted | INTEGER | Mutado? (0/1) |

#### charging_sessions
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| hostname | TEXT | Servidor de origem |
| start_time | INTEGER | Timestamp início |
| end_time | INTEGER | Timestamp fim |
| start_level | INTEGER | % bateria início |
| end_level | INTEGER | % bateria fim |
| duration_minutes | REAL | Duração em minutos |
| charging_rate | REAL | Taxa %/minuto |

#### event_logs (v2.8.0)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| hostname | TEXT | Servidor de origem |
| event_type | TEXT | Tipo do evento (dongle_connected, headset_turned_on, etc.) |
| severity | TEXT | info, warning, error, critical |
| timestamp | INTEGER | Timestamp do evento |
| headset_id | TEXT | ID do headset (opcional) |
| headset_name | TEXT | Nome do headset (opcional) |
| dongle_id | TEXT | ID do dongle (opcional) |
| message | TEXT | Mensagem descritiva |
| metadata | TEXT | JSON com dados adicionais |

#### dongle_connection_history (v2.8.0)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| hostname | TEXT | Servidor de origem |
| dongle_id | TEXT | ID do dongle |
| dongle_name | TEXT | Nome do dongle |
| connected_at | INTEGER | Timestamp conexão |
| disconnected_at | INTEGER | Timestamp desconexão |
| disconnect_reason | TEXT | normal, usb_removed, connection_lost, error |
| session_duration | INTEGER | Duração em ms |
| metadata | TEXT | JSON com dados adicionais |

#### headset_sessions (v2.8.0)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| hostname | TEXT | Servidor de origem |
| headset_id | TEXT | ID do headset |
| headset_name | TEXT | Nome do headset |
| start_time | INTEGER | Timestamp início |
| end_time | INTEGER | Timestamp fim |
| start_battery | INTEGER | % bateria início |
| end_battery | INTEGER | % bateria fim |
| disconnect_reason | TEXT | normal, connection_lost, dongle_removed |
| session_duration | INTEGER | Duração em ms |
| metadata | TEXT | JSON com dados adicionais |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE                                │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Browser/Web   │  │    Electron     │                   │
│  │  localhost:18080 │  │  (BrowserWindow)│                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              API REST + WebSocket                        ││
│  │              http://localhost:18080                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Node.js)                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    ApiServer                             ││
│  │  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐   ││
│  │  │HeadsetManager│ │BatteryTracker│ │  JabraService  │   ││
│  │  │  (SQLite)    │ │   (SQLite)   │ │  (Jabra SDK)   │   ││
│  │  └─────────────┘ └──────────────┘ └─────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              EventLogger (v2.8.0)                    │││
│  │  │              (SQLite - Logs persistentes)            │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              JABRA ENGAGE 55 MONO (USB/HID)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Contribuindo

### Branches

| Branch | Descrição |
|--------|-----------|
| `main` | Produção estável |
| `develop` | Desenvolvimento ativo |
| `feature/*` | Novas funcionalidades |
| `fix/*` | Correções de bugs |

### Como Contribuir

1. **Fork** o repositório
2. Clone sua fork: `git clone https://github.com/seu-usuario/fast-drive-monitor.git`
3. Crie uma branch a partir de `develop`:
   ```bash
   git checkout develop
   git checkout -b feature/minha-feature
   ```
4. Faça suas alterações
5. Execute os testes: `npm test`
6. Commit seguindo o padrão [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: adicionar nova funcionalidade"
   ```
7. Push para sua fork: `git push origin feature/minha-feature`
8. Abra um **Pull Request** para `develop`

### Padrões de Commit

| Prefixo | Descrição |
|---------|-----------|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Documentação |
| `test:` | Testes |
| `refactor:` | Refatoração |
| `chore:` | Tarefas de manutenção |

### Requisitos para PR

- [ ] Todos os testes passando
- [ ] Código segue o estilo do projeto
- [ ] Documentação atualizada (se aplicável)
- [ ] Changelog atualizado (para features/fixes)

---

## Estatísticas do Projeto

### Desenvolvimento

| Métrica | Valor |
|---------|-------|
| **Início do projeto** | Janeiro 2026 |
| **Linguagem principal** | JavaScript (Node.js) |
| **Banco de dados** | SQLite (better-sqlite3) |
| **Testes** | 79 testes automatizados |
| **Cobertura** | HeadsetManager, BatteryTracker, API, UpdateManager |

### Arquivos do Projeto

```
projeto_fast_drive/
├── src/
│   ├── api/
│   │   ├── server.js          # API REST + WebSocket
│   │   └── server.test.js     # Testes API
│   ├── batteryTracker.js      # Rastreamento de bateria
│   ├── batteryTracker.test.js # Testes bateria
│   ├── eventLogger.js         # Sistema de logs (v2.8.0)
│   ├── headsetManager.js      # Gerenciamento de headsets
│   ├── headsetManager.test.js # Testes headsets
│   ├── jabraService.js        # Integração Jabra SDK
│   ├── updateManager.js       # Sistema de atualização
│   └── updateManager.test.js  # Testes update
├── public/                     # Frontend web
├── scripts/                    # Scripts de deploy
├── data/                       # Bancos SQLite
├── flake.nix                   # Configuração Nix Flakes
├── shell.nix                   # Configuração Nix Shell
├── package.json                # Dependências npm
└── README.md                   # Esta documentação
```

### Recursos Utilizados no Desenvolvimento

Este projeto foi desenvolvido com assistência de IA (Claude Code).

| Recurso | Estimativa |
|---------|------------|
| **Sessões de desenvolvimento** | ~6 sessões |
| **Funcionalidades implementadas** | 21+ |
| **Testes escritos** | 79 |
| **Endpoints API** | 20+ |
| **Horas estimadas** | ~16h |

> **Nota:** O projeto foi desenvolvido ao longo de várias sessões, iniciando em 2026-01-14 até 2026-01-16.

---

## Changelog

### [2.8.0] - 2026-01-16

#### Adicionado
- **EventLogger** - Módulo de logs persistente em SQLite
- **API /api/logs** - Consulta de logs com filtros (tipo, severidade, data, headset, dongle)
- **API /api/logs/stats** - Estatísticas agregadas de eventos
- **API /api/logs/dongles** - Histórico de conexões de dongle USB
- **API /api/logs/sessions** - Sessões de uso do headset (duração, bateria)
- **API /api/logs/types** - Tipos de eventos disponíveis
- **Tracking de dongle** - Diferencia desconexão física (usb_removed) vs perda de sinal (connection_lost)
- **Log de chamadas** - Registra início/fim de chamadas com duração
- **Motivos de desconexão** - normal, connection_lost, dongle_removed, usb_removed

---

### [2.7.0] - 2026-01-16

#### Adicionado
- **Alerta de bateria baixa** - Toast e som quando bateria < 20%
- **Tempo estimado** - Mostra tempo restante de bateria/carga
- **Notificação de desconexão** - Alerta quando headset desconecta
- **Sparkline de bateria** - Mini gráfico do histórico de bateria
- **Log de eventos** - Painel com eventos recentes (conexões, alertas)
- **Exportar dados** - Export para JSON ou CSV
- **Tema claro/escuro** - Toggle de tema com persistência
- **Som de alerta** - Beep sonoro para alertas críticos
- **Modo compacto** - Interface reduzida para telas menores

---

### [2.6.0] - 2026-01-16

#### Adicionado
- **IP do servidor** - Exibe IP local na interface
- **Versão** - Exibe versão da aplicação
- **Data de início** - Mostra quando servidor iniciou
- **Uptime formatado** - Tempo de atividade em dias/horas/minutos

---

### [2.5.0] - 2026-01-16

#### Adicionado
- **Relógio** - Exibe hora atual na interface
- **Hostname visível** - Mostra hostname do servidor na interface

---

### [2.4.0] - 2026-01-16

#### Alterado
- **Porta da API alterada** de 3000 para 18080 (padrão range 15000-35000)
- Atualizada documentação com nova porta
- Atualizados scripts de deploy

---

### [2.3.0] - 2026-01-15

#### Adicionado
- **Testes automatizados** - Suite completa com 79 testes
  - HeadsetManager: 27 testes
  - BatteryTracker: 21 testes
  - API Server: 19 testes
  - UpdateManager: 12 testes
- **Documentação expandida**
  - Exemplos JSON de cada endpoint
  - Seção de coexistência com aplicações C#
  - Guia do sistema de atualização
  - Instruções de contribuição

#### Corrigido
- JabraService.disconnect() verifica se sdk.stop() existe antes de chamar

---

### [2.2.0] - 2026-01-15

#### Adicionado
- **Sistema de Updates via Git** - UpdateManager para atualizações remotas
- **Validação de cor exclusiva** - Cada headset deve ter cor única
- **Validação de ID e serial** - Previne duplicatas
- **Scripts de deploy Windows** - Instalação NSSM e atualização em massa

---

### [2.1.0] - 2026-01-15

#### Adicionado
- **Hostname em todos os dados** - Cada registro agora inclui o hostname do servidor
  - API REST retorna hostname em todas as respostas
  - WebSocket inclui hostname em todas as mensagens
  - Banco de dados armazena hostname em todas as tabelas
  - Migração automática para bancos existentes
- **Novo endpoint** `/api/server-info` - Informações do servidor
- **serverInfo** no WebSocket init - Platform, arch, nodeVersion, uptime

#### Alterado
- HeadsetManager agora inclui hostname em headsets e dongles
- BatteryTracker inclui hostname em todas as sessões e histórico

---

### [2.0.0] - 2026-01-14

#### Adicionado
- **Frontend Web Minimalista** (`public/`)
- **API REST Backend** (`src/api/server.js`)
- **Gerenciador de Headsets** (`src/headsetManager.js`)
- Sistema de cores e numeração para headsets
- WebSocket para atualizações em tempo real

---

### [1.0.0] - 2026-01-14

#### Adicionado
- Estrutura inicial do projeto
- Integração com Jabra SDK
- Monitoramento de bateria
- Interface CLI e Electron
- Configuração Nix
- Persistência em SQLite

---

## Referências

- [Jabra Developer Portal](https://developer.jabra.com/)
- [@gnaudio/jabra-js npm](https://www.npmjs.com/package/@gnaudio/jabra-js)
- [Electron Documentation](https://www.electronjs.org/docs)
- [NSSM - Non-Sucking Service Manager](https://nssm.cc/)
- [Nix Flakes](https://nixos.wiki/wiki/Flakes)

---

## Licença

MIT
