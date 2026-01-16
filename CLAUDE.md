# CLAUDE.md - Fast Drive Project Context

Este arquivo fornece contexto para o Claude Code ao trabalhar neste projeto.

## Visão Geral do Projeto

**Fast Drive** é um sistema de monitoramento de headsets Jabra Engage 55 Mono, desenvolvido em Node.js com:

- **Backend:** Express.js (API REST) + WebSocket
- **Frontend:** HTML/CSS/JS minimalista + Electron
- **Banco de Dados:** SQLite (better-sqlite3)
- **SDK:** @gnaudio/jabra-js para integração com headsets
- **Ambiente:** Nix Flakes para desenvolvimento

## Estrutura do Projeto

```
projeto_fast_drive/
├── src/
│   ├── api/
│   │   ├── server.js          # API REST + WebSocket (entrada principal)
│   │   └── server.test.js     # Testes da API
│   ├── batteryTracker.js      # Rastreamento de bateria e estimativas
│   ├── batteryTracker.test.js
│   ├── headsetManager.js      # Gerenciamento de headsets (CRUD, validação)
│   ├── headsetManager.test.js
│   ├── jabraService.js        # Integração com Jabra SDK
│   ├── updateManager.js       # Sistema de atualização via git
│   ├── updateManager.test.js
│   └── index.js               # Entrada CLI
├── public/                     # Frontend web estático
├── scripts/                    # Scripts de deploy (PowerShell)
├── data/                       # Bancos SQLite (gitignore)
├── main.js                     # Entrada Electron
├── package.json
├── flake.nix                   # Ambiente Nix
└── shell.nix
```

## Comandos Importantes

```bash
# Desenvolvimento (requer nix-shell para Linux)
nix-shell                        # Entrar no ambiente
npm install                      # Instalar dependências
npm start                        # Servidor web (porta 3000)
npm run electron                 # Aplicação desktop
npm test                         # Executar testes

# Build
npm run build:linux              # Build Linux
npm run build:win                # Build Windows
```

## Convenções de Código

### JavaScript
- **Sem TypeScript** - Projeto usa JavaScript puro (ES2022)
- **CommonJS** - `require()` e `module.exports`
- **Async/await** - Preferido sobre callbacks
- **EventEmitter** - Para comunicação entre módulos

### Nomenclatura
- **Arquivos:** camelCase (`headsetManager.js`)
- **Classes:** PascalCase (`HeadsetManager`)
- **Funções/variáveis:** camelCase (`getRegisteredHeadsets`)
- **Constantes:** UPPER_SNAKE_CASE (`HEADSET_COLORS`)

### Testes
- Framework: `node:test` (nativo do Node.js)
- Padrão de arquivo: `*.test.js` no mesmo diretório
- Executar: `npm test` ou `node --test src/**/*.test.js`

## Padrões Importantes

### 1. Hostname em Todos os Dados
Cada registro deve incluir `hostname` para identificação no datalake:
```javascript
const data = {
  hostname: os.hostname(),
  // ... outros dados
};
```

### 2. Validação de Cor Exclusiva
Cada headset tem uma cor única (máximo 5 headsets):
```javascript
const HEADSET_COLORS = {
  blue: { name: 'Azul', hex: '#3B82F6' },
  yellow: { name: 'Amarelo', hex: '#EAB308' },
  green: { name: 'Verde', hex: '#22C55E' },
  red: { name: 'Vermelho', hex: '#EF4444' },
  white: { name: 'Branco', hex: '#F8FAFC' }
};
```

### 3. Resposta da API
Todas as respostas incluem `hostname`:
```javascript
res.json({
  hostname: os.hostname(),
  data: result
});
```

### 4. Logging
Usar console.log com prefixo do módulo:
```javascript
console.log('[HeadsetManager] Headset registrado:', headset.name);
```

## API REST

Base URL: `http://localhost:3000/api`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/server-info` | Info do servidor |
| GET | `/api/state` | Estado completo |
| GET | `/api/headsets` | Listar headsets |
| POST | `/api/headsets` | Criar headset |
| PUT | `/api/headsets/:id` | Atualizar headset |
| DELETE | `/api/headsets/:id` | Remover headset |
| GET | `/api/colors` | Cores disponíveis |
| GET | `/api/stats` | Estatísticas |
| GET | `/api/update/status` | Status de updates |
| POST | `/api/update/check` | Verificar updates |
| POST | `/api/update/apply` | Aplicar update |

## WebSocket

Conectar em: `ws://localhost:3000/ws`

Eventos: `init`, `headsetRegistered`, `headsetUpdated`, `headsetRemoved`, `headsetStateUpdated`, `dongleConnected`, `dongleDisconnected`

## Banco de Dados

### Tabelas Principais
- `headsets` - Headsets registrados (id, hostname, name, color, number)
- `battery_history` - Histórico de bateria
- `charging_sessions` - Sessões de carregamento
- `usage_sessions` - Sessões de uso

### Migrações
Migrações automáticas no `initialize()` de cada módulo:
```javascript
async initialize() {
  // Criar tabelas se não existem
  // Migrar dados antigos se necessário
}
```

## Problemas Conhecidos

### Python 3.14 e distutils
O `better-sqlite3` requer compilação nativa. Use Python 3.11 via nix-shell:
```bash
nix-shell  # Configura Python 3.11 automaticamente
```

### Jabra SDK sem Partner Key
Funciona sem partner key, mas exibe warning. Para produção, obtenha em developer.jabra.com.

## Fluxo de Trabalho Git

```bash
# Branches
main     # Produção
develop  # Desenvolvimento

# Commits (Conventional Commits)
feat:     # Nova funcionalidade
fix:      # Correção de bug
docs:     # Documentação
test:     # Testes
refactor: # Refatoração
```

## Dicas para Claude

1. **Sempre ler arquivos antes de editar** - Entender o contexto existente
2. **Manter hostname** - Incluir em todas as respostas/dados
3. **Testes primeiro** - Verificar testes existentes antes de modificar
4. **Nix para Linux** - Usar `nix-shell` para ambiente correto
5. **Evitar breaking changes** - Manter compatibilidade da API
6. **Documentar no README** - Atualizar changelog e exemplos
