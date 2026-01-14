# Fast Drive - Jabra Engage 55 Mono Monitor

> Documento de referência do projeto. Atualizado a cada mudança significativa.

**Versão:** 1.0.0
**Última atualização:** 2026-01-14
**Status:** Em desenvolvimento

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Tecnologias](#tecnologias)
5. [Instalação](#instalação)
6. [Uso](#uso)
7. [Configuração Nix](#configuração-nix)
8. [API e Eventos](#api-e-eventos)
9. [Banco de Dados](#banco-de-dados)
10. [Changelog](#changelog)

---

## Visão Geral

**Fast Drive** é uma aplicação para monitoramento do headset **Jabra Engage 55 Mono**, desenvolvida em Node.js com interface gráfica via Electron.

### Funcionalidades Principais

| Funcionalidade | Descrição | Status |
|----------------|-----------|--------|
| Conexão USB | Detecta e conecta ao headset via SDK Jabra | Implementado |
| Nível de Bateria | Exibe percentual atual da bateria | Implementado |
| Status Carregamento | Detecta quando está carregando | Implementado |
| Tempo para Carga | Estima tempo até 100% | Implementado |
| Autonomia | Estima duração da bateria | Implementado |
| Status de Chamada | Detecta se está em chamada | Implementado |
| Status de Mudo | Detecta se microfone está mudo | Implementado |
| Histórico | Persiste dados em SQLite | Implementado |
| Interface Electron | UI gráfica multiplataforma | Implementado |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      ELECTRON (main.js)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   BrowserWindow │  │      Tray       │  │  IPC Main   │  │
│  └────────┬────────┘  └─────────────────┘  └──────┬──────┘  │
│           │                                        │         │
│           ▼                                        ▼         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   FastDriveApp                          ││
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   ││
│  │  │    JabraService     │  │    BatteryTracker       │   ││
│  │  │  - SDK Connection   │  │  - Charging Sessions    │   ││
│  │  │  - Device Events    │  │  - Usage Sessions       │   ││
│  │  │  - Call Control     │  │  - Statistics           │   ││
│  │  │  - Properties       │  │  - SQLite Database      │   ││
│  │  └─────────────────────┘  └─────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    JABRA SDK (@gnaudio/jabra-js)            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Core Module   │  │ Properties Mod. │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              JABRA ENGAGE 55 MONO (USB/HID)                 │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados

1. **Detecção**: SDK detecta headset via USB
2. **Conexão**: JabraService estabelece comunicação
3. **Monitoramento**: Eventos são emitidos para mudanças de estado
4. **Rastreamento**: BatteryTracker registra e analisa dados
5. **Persistência**: SQLite armazena histórico
6. **Interface**: Electron exibe informações ao usuário

---

## Estrutura de Arquivos

```
projeto_fast_drive/
│
├── nix_fast_drive              # Flake Nix para ambiente de desenvolvimento
├── package.json                # Dependências e scripts npm
├── main.js                     # Processo principal Electron
├── preload.js                  # Bridge segura IPC
├── index.html                  # Interface gráfica
│
├── src/
│   ├── index.js                # Aplicação principal (CLI + API)
│   ├── jabraService.js         # Serviço de comunicação com Jabra SDK
│   └── batteryTracker.js       # Rastreamento e análise de bateria
│
├── udev/
│   └── 99-jabra.rules          # Regras udev para permissões USB (Linux)
│
├── data/                       # (Gerado) Dados persistidos
│   └── battery_tracker.db      # Banco SQLite
│
├── .env.example                # Exemplo de configuração
├── .gitignore                  # Arquivos ignorados
└── PROJETO.md                  # Este documento
```

---

## Tecnologias

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Node.js | >= 18.0.0 | Runtime JavaScript |
| Electron | ^28.2.0 | Interface gráfica desktop |
| @gnaudio/jabra-js | ^4.4.1 | SDK oficial Jabra |
| @gnaudio/jabra-js-properties | ^1.0.3 | Telemetria e propriedades |
| better-sqlite3 | ^9.4.3 | Banco de dados local |
| rxjs | ^7.8.1 | Programação reativa |
| Nix | - | Gerenciamento de ambiente |

---

## Instalação

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Nix (opcional, recomendado)

### Via npm

```bash
cd projeto_fast_drive
npm install
```

### Via Nix

```bash
cd projeto_fast_drive
nix develop -f nix_fast_drive
npm install
```

### Permissões USB (Linux)

```bash
sudo cp udev/99-jabra.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Adicione seu usuário ao grupo `plugdev`:
```bash
sudo usermod -aG plugdev $USER
```
(Faça logout/login após este comando)

---

## Uso

### Modo CLI (Terminal)

```bash
npm start
```

Saída esperada:
```
==========================================
  Fast Drive - Jabra Headset Monitor
==========================================

[FastDrive] Aplicação iniciada
[FastDrive] Aguardando conexão do headset...

[JabraService] Dispositivo detectado: Jabra Engage 55 Mono
[FastDrive] Headset conectado: Jabra Engage 55 Mono

------------------------------------------
  Bateria: [================    ] 80%
------------------------------------------
```

### Modo Gráfico (Electron)

```bash
npm run electron
```

### Modo Desenvolvimento

```bash
# CLI com hot-reload
npm run dev

# Electron com DevTools
npm run electron:dev
```

### Build para Distribuição

```bash
# Linux (AppImage + deb)
npm run build:linux

# Windows (NSIS + portable)
npm run build:win

# Ambos
npm run build:all
```

---

## Configuração Nix

O projeto inclui configuração Nix para garantir um ambiente de desenvolvimento reproduzível e isolado.

### Arquivos Nix disponíveis

| Arquivo | Tipo | Uso |
|---------|------|-----|
| `flake.nix` | Nix Flake | Método moderno (recomendado) |
| `shell.nix` | Nix Shell | Método tradicional |
| `nix_fast_drive` | Cópia | Arquivo original do flake |

### Dependências incluídas

- **Runtime**: Node.js 20, npm, yarn
- **Desktop**: Electron
- **USB/HID**: libusb1, hidapi, udev
- **Build**: gcc, make, pkg-config, python3
- **Debug**: usbutils

### Método 1: Nix Flakes (Recomendado)

Flakes é o método moderno e recomendado. Requer Nix 2.4+ com flakes habilitado.

#### Habilitar Flakes (se ainda não estiver habilitado)

```bash
# Adicionar ao ~/.config/nix/nix.conf ou /etc/nix/nix.conf
experimental-features = nix-command flakes
```

Ou usar temporariamente com flag:
```bash
nix --experimental-features 'nix-command flakes' develop
```

#### Entrar no ambiente de desenvolvimento

```bash
cd projeto_fast_drive

# Entrar no shell de desenvolvimento
nix develop

# Ou especificando o arquivo
nix develop .#default
```

#### Comandos úteis com Flakes

```bash
# Mostrar informações do flake
nix flake show

# Atualizar dependências do flake
nix flake update

# Verificar flake
nix flake check

# Entrar em shell sem cache
nix develop --refresh
```

### Método 2: Nix Shell (Tradicional)

Para quem não usa Flakes ou prefere o método clássico.

```bash
cd projeto_fast_drive

# Entrar no ambiente
nix-shell

# Ou especificando o arquivo
nix-shell shell.nix
```

### Método 3: direnv (Automático)

Para entrar automaticamente no ambiente ao acessar a pasta.

#### Instalar direnv

```bash
# NixOS
nix-env -iA nixpkgs.direnv

# Adicionar ao seu shell (~/.bashrc ou ~/.zshrc)
eval "$(direnv hook bash)"  # ou zsh
```

#### Configurar no projeto

```bash
cd projeto_fast_drive

# Criar arquivo .envrc
echo "use flake" > .envrc

# Permitir direnv nesta pasta
direnv allow
```

Agora, ao entrar na pasta, o ambiente será carregado automaticamente.

### Fluxo de trabalho completo

```bash
# 1. Entrar na pasta do projeto
cd projeto_fast_drive

# 2. Ativar ambiente Nix
nix develop
# ou
nix-shell

# 3. Instalar dependências Node.js
npm install

# 4. Configurar permissões USB (apenas uma vez)
sudo cp udev/99-jabra.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger

# 5. Executar aplicação
npm start           # Modo CLI
npm run electron    # Modo gráfico
```

### O que acontece ao entrar no ambiente Nix

1. **Variáveis de ambiente configuradas**:
   - `LD_LIBRARY_PATH` - bibliotecas USB/HID
   - `PKG_CONFIG_PATH` - configurações de build
   - `ELECTRON_OVERRIDE_DIST_PATH` - caminho do Electron

2. **Ferramentas disponíveis**:
   - `node`, `npm`, `yarn`
   - `electron`
   - `gcc`, `make`, `pkg-config`
   - `lsusb` (debug USB)

3. **Mensagem de boas-vindas** com comandos disponíveis

### Solução de problemas

#### Electron não inicia
```bash
# Verificar se Electron está no PATH
which electron

# Verificar variável de ambiente
echo $ELECTRON_OVERRIDE_DIST_PATH
```

#### Dispositivo USB não detectado
```bash
# Listar dispositivos USB
lsusb | grep -i jabra

# Verificar regras udev
cat /etc/udev/rules.d/99-jabra.rules

# Recarregar regras
sudo udevadm control --reload-rules
sudo udevadm trigger
```

#### Erro de permissão
```bash
# Verificar grupos do usuário
groups

# Adicionar ao grupo plugdev
sudo usermod -aG plugdev $USER
# Fazer logout/login
```

---

## API e Eventos

### JabraService

```javascript
const { JabraService } = require('./src/jabraService');

const jabra = new JabraService();
await jabra.initialize();

// Eventos disponíveis
jabra.on('connected', (data) => { /* dispositivo conectado */ });
jabra.on('disconnected', (data) => { /* dispositivo desconectado */ });
jabra.on('batteryChange', (data) => { /* mudança de bateria */ });
jabra.on('chargingStarted', (data) => { /* carregador conectado */ });
jabra.on('chargingStopped', (data) => { /* carregador desconectado */ });
jabra.on('callStateChange', (data) => { /* estado de chamada */ });
jabra.on('muteChange', (data) => { /* estado de mudo */ });

// Métodos
jabra.getState();        // Estado atual completo
jabra.getBatteryLevel(); // Nível de bateria
jabra.isCharging();      // Está carregando?
jabra.isInCall();        // Está em chamada?
jabra.isMuted();         // Está mutado?
jabra.listDevices();     // Lista dispositivos Jabra
```

### BatteryTracker

```javascript
const { BatteryTracker } = require('./src/batteryTracker');

const tracker = new BatteryTracker();
await tracker.initialize();

// Eventos
tracker.on('chargingStarted', (data) => { /* início de carga */ });
tracker.on('chargingEnded', (data) => { /* fim de carga */ });
tracker.on('usageStarted', (data) => { /* início de uso */ });
tracker.on('usageEnded', (data) => { /* fim de uso */ });

// Métodos
tracker.calculateEstimates();     // Estimativas atuais
tracker.estimateTimeToFullCharge(level);  // Tempo para 100%
tracker.estimateBatteryLife(level);       // Autonomia
tracker.getChargingHistory(limit);        // Histórico de cargas
tracker.getUsageHistory(limit);           // Histórico de uso
tracker.getBatteryHistory(hours);         // Histórico de bateria
tracker.getStatistics();                  // Estatísticas completas
```

### FastDriveApp

```javascript
const { FastDriveApp } = require('./src/index');

const app = new FastDriveApp();
await app.start();

// Métodos
app.getStatus();           // Estado completo
app.getBatteryHistory(24); // Histórico 24h
app.getChargingHistory();  // Histórico de cargas
app.getUsageHistory();     // Histórico de uso
app.getStatistics();       // Estatísticas
await app.stop();          // Finalizar
```

---

## Banco de Dados

### Tabelas

#### charging_sessions
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| start_time | INTEGER | Timestamp início |
| end_time | INTEGER | Timestamp fim |
| start_level | INTEGER | % bateria início |
| end_level | INTEGER | % bateria fim |
| duration_minutes | REAL | Duração em minutos |
| charging_rate | REAL | Taxa %/minuto |
| completed | INTEGER | Chegou a 100%? |

#### usage_sessions
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| start_time | INTEGER | Timestamp início |
| end_time | INTEGER | Timestamp fim |
| start_level | INTEGER | % bateria início |
| end_level | INTEGER | % bateria fim |
| duration_minutes | REAL | Duração em minutos |
| call_time_minutes | REAL | Tempo em chamada |
| drain_rate | REAL | Taxa descarga %/min |

#### battery_history
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER | PK auto-increment |
| timestamp | INTEGER | Momento da leitura |
| battery_level | INTEGER | Nível da bateria |
| is_charging | INTEGER | Carregando? (0/1) |
| is_in_call | INTEGER | Em chamada? (0/1) |
| is_muted | INTEGER | Mutado? (0/1) |

---

## Changelog

### [2.0.0] - 2026-01-14

#### Adicionado
- **Frontend Web Minimalista** (`public/`)
  - Interface responsiva com design dark mode
  - Visualização de dongles conectados (indicador verde)
  - Cards de headsets ativos com bateria, status de chamada e mudo
  - Lista de headsets registrados com status online/offline
  - Modal para adicionar/editar headsets
  - Sistema de cores para headsets (azul, amarelo, verde, vermelho, branco)
  - Numeração de headsets
  - Headsets aparecem quando ligados, desaparecem quando desligados

- **API REST Backend** (`src/api/server.js`)
  - Endpoints para gerenciar headsets
  - WebSocket para atualizações em tempo real
  - Integração com JabraService e BatteryTracker

- **Gerenciador de Headsets** (`src/headsetManager.js`)
  - Persistência de configurações em SQLite
  - Gerenciamento de múltiplos headsets
  - Rastreamento de dongles conectados
  - Sistema de cores e numeração

#### Alterado
- `npm start` agora inicia o servidor web (porta 3000)
- `npm start:cli` para modo CLI antigo
- Electron agora carrega interface via servidor local

#### Novos Scripts
- `npm start` - Servidor web com frontend
- `npm start:cli` - Modo CLI (terminal)
- `npm dev` - Servidor com hot-reload

---

### [1.0.2] - 2026-01-14

#### Corrigido
- Configuração Nix: Alterado de Python 3.13 para Python 3.11
- Resolução do erro `ModuleNotFoundError: No module named 'distutils'`
- O `node-gyp` (usado pelo `@gnaudio/jabra-node-sdk`) requer `distutils` que foi removido no Python 3.12+

#### Nota técnica
Python 3.12+ removeu o módulo `distutils` da biblioteca padrão. O `node-gyp` v8.4.1 ainda depende dele. Solução: usar Python 3.11 no ambiente Nix.

---

### [1.0.1] - 2026-01-14

#### Adicionado
- Documentação: Guia completo do GitHub CLI (`docs/GITHUB_CLI_GUIDE.md`)
- Repositório renomeado para `fast-drive-monitor`

#### Alterado
- Estrutura de pastas: criada pasta `docs/` para documentação adicional

---

### [1.0.0] - 2026-01-14

#### Adicionado
- Estrutura inicial do projeto
- Integração com Jabra SDK (@gnaudio/jabra-js)
- Serviço de conexão com headset (JabraService)
- Rastreamento de bateria (BatteryTracker)
- Persistência em SQLite
- Interface CLI
- Interface Electron
- Configuração Nix (nix_fast_drive)
- Regras udev para Linux
- Documentação inicial

#### Funcionalidades
- Detecção automática do Jabra Engage 55 Mono
- Monitoramento de nível de bateria
- Detecção de estado de carregamento
- Estimativa de tempo para carga completa
- Estimativa de autonomia da bateria
- Detecção de estado de chamada
- Detecção de estado de mudo
- Histórico de sessões de carregamento
- Histórico de sessões de uso
- Estatísticas de uso

---

## Próximos Passos

- [ ] Testes automatizados
- [ ] Notificações do sistema (bateria baixa, carga completa)
- [ ] Gráficos de histórico na interface
- [ ] Exportação de dados (CSV, JSON)
- [ ] Configurações personalizáveis na interface
- [ ] Suporte a múltiplos dispositivos Jabra
- [ ] Integração com sistemas de chamada (Teams, Zoom)

---

## Referências

- [Jabra Developer Portal](https://developer.jabra.com/)
- [Jabra JavaScript SDK](https://developer.jabra.com/sdks-and-tools/javascript)
- [@gnaudio/jabra-js npm](https://www.npmjs.com/package/@gnaudio/jabra-js)
- [Jabra Engage 55 User Manual](https://www.jabra.com/supportpages/jabra-engage-55)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Nix Flakes](https://nixos.wiki/wiki/Flakes)
