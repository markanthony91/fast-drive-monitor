# Fast Drive - Jabra Engage 55 Mono Monitor

> Sistema de monitoramento de headsets Jabra Engage 55 Mono com API REST, WebSocket e interface web.

**Versão:** 2.1.0
**Última atualização:** 2026-01-15
**Status:** Em desenvolvimento

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Funcionalidades](#funcionalidades)
3. [Instalação](#instalação)
4. [Uso](#uso)
5. [API REST](#api-rest)
6. [WebSocket](#websocket)
7. [Testando com cURL](#testando-com-curl)
8. [Configuração Nix](#configuração-nix)
9. [Banco de Dados](#banco-de-dados)
10. [Deploy no Windows](#deploy-no-windows)
11. [Arquitetura](#arquitetura)
12. [Changelog](#changelog)

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
# Acesse: http://localhost:3000
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

Base URL: `http://localhost:3000/api`

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

---

## WebSocket

Conecte em: `ws://localhost:3000/ws`

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
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(`[${message.hostname}] ${message.type}:`, message.data);
};
```

---

## Testando com cURL

### Informações do Servidor

```bash
curl http://localhost:3000/api/server-info
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
curl http://localhost:3000/api/state
```

### Listar Headsets

```bash
curl http://localhost:3000/api/headsets
```

### Obter Headset Específico

```bash
curl http://localhost:3000/api/headsets/hs_123456789
```

### Registrar Novo Headset

```bash
curl -X POST http://localhost:3000/api/headsets \
  -H "Content-Type: application/json" \
  -d '{"name": "Headset Marcelo", "color": "blue", "number": 1}'
```

### Atualizar Headset

```bash
curl -X PUT http://localhost:3000/api/headsets/hs_123456789 \
  -H "Content-Type: application/json" \
  -d '{"name": "Novo Nome", "color": "green"}'
```

### Remover Headset

```bash
curl -X DELETE http://localhost:3000/api/headsets/hs_123456789
```

### Listar Dongles Conectados

```bash
curl http://localhost:3000/api/dongles
```

### Cores Disponíveis

```bash
curl http://localhost:3000/api/colors
```

### Estatísticas Completas

```bash
curl http://localhost:3000/api/stats
```

### Histórico de Bateria (últimas 24 horas)

```bash
curl "http://localhost:3000/api/stats/battery-history?hours=24"
```

### Histórico de Carregamento

```bash
curl "http://localhost:3000/api/stats/charging-history?limit=10"
```

### Testar WebSocket com websocat

```bash
# Instalar websocat
# Fedora: sudo dnf install websocat
# Ubuntu: sudo apt install websocat

websocat ws://localhost:3000/ws
```

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

EXPOSE 3000

CMD ["node", "src/api/server.js"]
```

**docker-compose.yml:**

```yaml
version: '3.8'
services:
  fast-drive:
    build: .
    ports:
      - "3000:3000"
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

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENTE                                │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Browser/Web   │  │    Electron     │                   │
│  │  localhost:3000 │  │  (BrowserWindow)│                   │
│  └────────┬────────┘  └────────┬────────┘                   │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              API REST + WebSocket                        ││
│  │              http://localhost:3000                       ││
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
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              JABRA ENGAGE 55 MONO (USB/HID)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Changelog

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
