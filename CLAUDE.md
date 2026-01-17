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
npm start                        # Servidor web (porta 18080)
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

Base URL: `http://localhost:18080/api`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/server-info` | Info do servidor |
| GET | `/api/state` | Estado completo |
| GET | `/api/headsets` | Listar headsets |
| GET | `/api/headsets/active` | Headsets ativos |
| POST | `/api/headsets` | Criar headset |
| PUT | `/api/headsets/:id` | Atualizar headset |
| DELETE | `/api/headsets/:id` | Remover headset |
| GET | `/api/dongles` | Dongles conectados |
| GET | `/api/colors` | Cores disponíveis |
| GET | `/api/stats` | Estatísticas |
| GET | `/api/stats/battery-history` | Histórico de bateria |
| GET | `/api/stats/charging-history` | Histórico de carregamento |
| GET | `/api/update/status` | Status de updates |
| GET | `/api/update/check` | Verificar updates |
| POST | `/api/update/apply` | Aplicar update |
| GET | `/api/logs` | Buscar logs (filtros: type, severity, headsetId, dongleId, startTime, endTime) |
| GET | `/api/logs/stats` | Estatísticas de logs |
| GET | `/api/logs/dongles` | Histórico de conexões de dongle |
| GET | `/api/logs/sessions` | Sessões de headset |
| GET | `/api/logs/types` | Tipos de eventos disponíveis |

## WebSocket

Conectar em: `ws://localhost:18080/ws`

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

## Fluxo de Trabalho Obrigatório para Claude

### 1. Ambiente
- **SEMPRE** usar `nix-shell` antes de qualquer operação
- Verificar se ambiente está configurado corretamente

### 2. Desenvolvimento de Features
Para cada nova feature ou correção:
```bash
# 1. Implementar a feature
# 2. Executar testes (OBRIGATÓRIO)
npm test

# 3. Incrementar versão no package.json
# - patch (X.X.1): correções de bugs
# - minor (X.1.0): novas features
# - major (1.0.0): breaking changes

# 4. Atualizar README.md se necessário

# 5. Commit com mensagem descritiva
git add .
git commit -m "feat: descrição da feature"

# 6. Push para repositório remoto
git push origin main
git push origin develop
```

### 3. Versionamento Semântico
```
MAJOR.MINOR.PATCH

2.3.0 → 2.3.1  # fix: correção de bug
2.3.1 → 2.4.0  # feat: nova funcionalidade
2.4.0 → 3.0.0  # breaking change
```

## Contexto de Uso - Servidor Kiosk

Este sistema é destinado para **servidores Kiosk**, onde os atendentes **não têm acesso direto** ao servidor em si. O Fast Drive roda no servidor e monitora os headsets Jabra conectados.

### Arquitetura Atual
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Headset Jabra  │────▶│  Servidor Kiosk  │────▶│  Interface Web  │
│  Engage 55      │     │  (Fast Drive)    │     │  (Admin)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Roadmap Futuro - Integração Kiosk

**Fase 1 (Atual):** Monitoramento via interface web admin
- Dashboard de headsets ativos
- Alertas de bateria baixa
- Log de eventos

**Fase 2 (Planejado):** Exibição no Kiosk
- Widget informativo no kiosk mostrando status do headset do atendente
- Indicador visual de bateria no canto da tela do kiosk
- Notificação para o atendente quando bateria estiver baixa

**Fase 3 (Futuro):** Integração completa
- API para outros sistemas consultarem status dos headsets
- Webhook para alertas em sistemas externos
- Dashboard centralizado para múltiplos kiosks

## Estatísticas do Projeto

| Métrica | Valor |
|---------|-------|
| Versão | 2.8.0 |
| Linhas de código | ~5.500 |
| Arquivos JS | 11 |
| Testes | 63 |
| Horas estimadas | ~16h |
| Início | 2026-01-14 |
| Última atualização | 2026-01-16 |

### Histórico de Desenvolvimento
| Versão | Data | Horas | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-01-14 | 3h | Versão inicial - CLI Jabra Monitor |
| 2.0.0 | 2026-01-14 | 3h | Frontend web e API REST |
| 2.1.0 | 2026-01-15 | 2h | Hostname tracking |
| 2.2.0 | 2026-01-15 | 2h | Sistema de auto-update e validação |
| 2.3.0 | 2026-01-16 | 2h | Documentação expandida e testes |
| 2.4.0 | 2026-01-16 | 0.5h | Alteração da porta para 18080 |
| 2.5.0 | 2026-01-16 | 0.5h | Relógio e hostname na interface |
| 2.6.0 | 2026-01-16 | 0.5h | IP, versão, data e uptime na interface |
| 2.7.0 | 2026-01-16 | 2h | Features avançadas: alertas, sparkline, temas, export |
| 2.8.0 | 2026-01-16 | 2h | Sistema de logs completo para integração |

### Features da Versão 2.8.0
- **EventLogger** - Módulo de logs persistente em SQLite
- **API /api/logs** - Consulta de logs com filtros (tipo, severidade, data)
- **API /api/logs/dongles** - Histórico de conexões de dongle USB
- **API /api/logs/sessions** - Sessões de uso do headset (duração, bateria)
- **API /api/logs/stats** - Estatísticas agregadas de eventos
- **Tracking de dongle** - Diferencia desconexão física vs perda de sinal
- **Log de chamadas** - Registra início/fim de chamadas com duração
- **Motivos de desconexão** - normal, connection_lost, dongle_removed

### Features da Versão 2.7.0
- **Alerta de bateria baixa** - Toast e som quando bateria < 20%
- **Tempo estimado** - Mostra tempo restante de bateria/carga
- **Notificação de desconexão** - Alerta quando headset desconecta
- **Sparkline de bateria** - Mini gráfico do histórico de bateria
- **Log de eventos** - Painel com eventos recentes (conexões, alertas)
- **Exportar dados** - Export para JSON ou CSV
- **Tema claro/escuro** - Toggle de tema com persistência
- **Som de alerta** - Beep sonoro para alertas críticos
- **Modo compacto** - Interface reduzida para telas menores

## Dicas para Claude

1. **Nix obrigatório** - Sempre usar `nix-shell` para desenvolvimento
2. **Testar sempre** - Executar `npm test` após cada modificação
3. **Commit frequente** - Fazer commit e push de cada evolução
4. **Versionar** - Incrementar versão no package.json
5. **Documentar** - Manter README.md atualizado
6. **Manter hostname** - Incluir em todas as respostas/dados
7. **Portas** - API usa porta 18080 (range 15000-35000)
8. **Estimar tempo** - Registrar horas gastas nas estatísticas
9. **Branches** - Manter main e develop sincronizados
10. **Ler antes de editar** - Entender contexto existente
11. **Mínimo necessário** - Não adicionar código além do solicitado

## Checklist de Entrega

- [ ] Testes passando (`npm test`)
- [ ] Versão incrementada no `package.json`
- [ ] README.md atualizado
- [ ] Commit realizado com mensagem descritiva
- [ ] Push para repositório remoto
- [ ] Estatísticas atualizadas neste arquivo
