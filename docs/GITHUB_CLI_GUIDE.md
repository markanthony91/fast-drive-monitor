# Guia Completo: GitHub via CLI

> Como criar e gerenciar repositórios GitHub usando linha de comando.

**Última atualização:** 2026-01-14

---

## Sumário

1. [Introdução](#introdução)
2. [Instalação do GitHub CLI](#instalação-do-github-cli)
3. [Autenticação](#autenticação)
4. [Criar Repositório](#criar-repositório)
5. [Clonar Repositório](#clonar-repositório)
6. [Operações Básicas do Git](#operações-básicas-do-git)
7. [Push e Pull](#push-e-pull)
8. [Comandos Úteis do gh](#comandos-úteis-do-gh)
9. [Troubleshooting](#troubleshooting)

---

## Introdução

O **GitHub CLI (`gh`)** é a ferramenta oficial de linha de comando do GitHub. Permite criar repositórios, gerenciar issues, pull requests e muito mais, tudo sem sair do terminal.

### Vantagens

- Criar repositórios sem acessar o navegador
- Automatizar workflows
- Integrar com scripts
- Mais rápido que a interface web

---

## Instalação do GitHub CLI

### Linux (via Nix) - Recomendado

```bash
# Uso temporário (sem instalar permanentemente)
nix-shell -p gh

# Instalar permanentemente
nix-env -iA nixpkgs.gh
```

### Linux (Fedora/RHEL)

```bash
sudo dnf install gh
```

### Linux (Ubuntu/Debian)

```bash
# Adicionar repositório oficial
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

# Instalar
sudo apt update
sudo apt install gh
```

### Linux (Arch)

```bash
sudo pacman -S github-cli
```

### macOS

```bash
# Via Homebrew
brew install gh

# Via MacPorts
sudo port install gh
```

### Windows

```powershell
# Via Winget
winget install GitHub.cli

# Via Chocolatey
choco install gh

# Via Scoop
scoop install gh
```

### Verificar instalação

```bash
gh --version
# Saída esperada: gh version X.X.X (YYYY-MM-DD)
```

---

## Autenticação

Antes de usar o `gh`, você precisa autenticar com sua conta GitHub.

### Login interativo (Recomendado)

```bash
gh auth login
```

**Passos:**

1. **Selecione o host:**
   ```
   ? What account do you want to log into?
   > GitHub.com
     GitHub Enterprise Server
   ```

2. **Selecione o protocolo:**
   ```
   ? What is your preferred protocol for Git operations on this host?
   > HTTPS
     SSH
   ```

3. **Selecione método de autenticação:**
   ```
   ? How would you like to authenticate GitHub CLI?
   > Login with a web browser
     Paste an authentication token
   ```

4. **Se escolheu web browser:**
   - Copie o código de 8 caracteres exibido
   - Pressione Enter para abrir o navegador
   - Cole o código no navegador
   - Autorize o aplicativo

### Login com token

```bash
# Criar token em: https://github.com/settings/tokens
gh auth login --with-token < token.txt

# Ou via echo
echo "ghp_xxxxxxxxxxxx" | gh auth login --with-token
```

### Verificar autenticação

```bash
gh auth status
```

**Saída esperada:**
```
github.com
  ✓ Logged in to github.com account USUARIO (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

### Logout

```bash
gh auth logout
```

---

## Criar Repositório

### Método 1: Criar e inicializar em um passo

Para um projeto que **já existe localmente**:

```bash
cd meu-projeto

# Inicializar git (se ainda não foi)
git init
git add -A
git commit -m "Initial commit"

# Criar repositório no GitHub e fazer push
gh repo create nome-do-repo --public --source=. --remote=origin --push
```

**Parâmetros:**
| Parâmetro | Descrição |
|-----------|-----------|
| `--public` | Repositório público |
| `--private` | Repositório privado |
| `--source=.` | Usar diretório atual como fonte |
| `--remote=origin` | Nome do remote (padrão: origin) |
| `--push` | Fazer push automaticamente |
| `--description "texto"` | Descrição do repositório |

### Método 2: Criar repositório vazio no GitHub

```bash
# Criar repositório vazio
gh repo create nome-do-repo --public --description "Descrição do projeto"

# Depois, localmente:
git init
git remote add origin https://github.com/USUARIO/nome-do-repo.git
git add -A
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

### Método 3: Criar interativamente

```bash
gh repo create
```

O CLI vai perguntar:
1. Nome do repositório
2. Descrição
3. Visibilidade (público/privado)
4. Adicionar README?
5. Adicionar .gitignore?
6. Escolher licença?

### Exemplos práticos

```bash
# Repositório público com descrição
gh repo create meu-app --public --description "Minha aplicação incrível"

# Repositório privado
gh repo create projeto-secreto --private

# Repositório a partir de template
gh repo create meu-projeto --template usuario/template-repo

# Criar em uma organização
gh repo create minha-org/novo-repo --public
```

---

## Clonar Repositório

### Clonar repositório existente

```bash
# Via HTTPS
gh repo clone usuario/repositorio

# Ou usando git diretamente
git clone https://github.com/usuario/repositorio.git

# Clonar para pasta específica
gh repo clone usuario/repositorio pasta-destino
```

### Clonar repositório próprio

```bash
# Lista seus repositórios
gh repo list

# Clonar um deles
gh repo clone nome-do-repo
```

### Fork e clone

```bash
# Fazer fork e clonar em um comando
gh repo fork usuario/repositorio --clone
```

---

## Operações Básicas do Git

### Configuração inicial (uma vez por máquina)

```bash
# Configurar nome e email
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Configurar branch padrão como main
git config --global init.defaultBranch main

# Ver configurações
git config --list
```

### Fluxo de trabalho básico

```bash
# 1. Verificar status
git status

# 2. Adicionar arquivos modificados
git add arquivo.txt          # Arquivo específico
git add .                    # Todos os arquivos
git add -A                   # Todos (incluindo deletados)

# 3. Criar commit
git commit -m "Descrição das mudanças"

# 4. Enviar para GitHub
git push
```

### Criar e mudar branches

```bash
# Criar nova branch
git branch nome-da-branch

# Mudar para branch
git checkout nome-da-branch

# Criar e mudar em um comando
git checkout -b nome-da-branch

# Listar branches
git branch -a

# Deletar branch local
git branch -d nome-da-branch

# Deletar branch remota
git push origin --delete nome-da-branch
```

### Ver histórico

```bash
# Log completo
git log

# Log resumido (uma linha por commit)
git log --oneline

# Log com gráfico de branches
git log --oneline --graph --all

# Ver mudanças do último commit
git show
```

---

## Push e Pull

### Push (Enviar para GitHub)

```bash
# Push simples (branch atual)
git push

# Push especificando remote e branch
git push origin main

# Push de nova branch (primeira vez)
git push -u origin nome-da-branch

# Push forçado (cuidado!)
git push --force
```

### Pull (Baixar do GitHub)

```bash
# Pull simples (branch atual)
git pull

# Pull especificando remote e branch
git pull origin main

# Pull com rebase (evita merge commits)
git pull --rebase

# Fetch (baixar sem mesclar)
git fetch origin
```

### Sincronizar repositório

```bash
# Baixar mudanças e mesclar
git pull

# Fazer suas mudanças
git add -A
git commit -m "Minhas mudanças"

# Enviar
git push
```

### Resolver conflitos

Se houver conflitos ao fazer pull:

```bash
# 1. Git vai marcar arquivos com conflito
git status

# 2. Editar arquivos manualmente
#    Procurar por marcadores:
#    <<<<<<< HEAD
#    (seu código)
#    =======
#    (código remoto)
#    >>>>>>> origin/main

# 3. Após resolver, adicionar e commitar
git add arquivo-resolvido.txt
git commit -m "Resolve conflitos"

# 4. Continuar push
git push
```

---

## Comandos Úteis do gh

### Repositórios

```bash
# Listar seus repositórios
gh repo list

# Ver detalhes de um repositório
gh repo view usuario/repo

# Abrir repositório no navegador
gh repo view usuario/repo --web

# Renomear repositório
gh repo rename novo-nome

# Deletar repositório
gh repo delete usuario/repo --yes

# Arquivar repositório
gh repo archive usuario/repo
```

### Issues

```bash
# Listar issues
gh issue list

# Criar issue
gh issue create --title "Bug encontrado" --body "Descrição do bug"

# Ver issue específica
gh issue view 123

# Fechar issue
gh issue close 123
```

### Pull Requests

```bash
# Listar PRs
gh pr list

# Criar PR
gh pr create --title "Nova feature" --body "Descrição"

# Ver PR
gh pr view 123

# Fazer checkout de PR
gh pr checkout 123

# Aprovar PR
gh pr review 123 --approve

# Merge PR
gh pr merge 123
```

### Gists

```bash
# Criar gist
gh gist create arquivo.txt

# Listar gists
gh gist list

# Ver gist
gh gist view ID
```

### Workflows (GitHub Actions)

```bash
# Listar workflows
gh workflow list

# Ver execuções
gh run list

# Ver detalhes de execução
gh run view ID
```

---

## Troubleshooting

### Erro: "Permission denied"

```bash
# Verificar autenticação
gh auth status

# Re-autenticar
gh auth login
```

### Erro: "Repository not found"

```bash
# Verificar se repositório existe
gh repo view usuario/repo

# Verificar URL do remote
git remote -v

# Corrigir URL
git remote set-url origin https://github.com/usuario/repo.git
```

### Erro: "Updates were rejected"

```bash
# Baixar mudanças primeiro
git pull --rebase

# Depois enviar
git push
```

### Erro: "Authentication failed"

```bash
# Limpar credenciais em cache
git credential-cache exit

# Re-autenticar
gh auth login
```

### Erro: "gh: command not found"

```bash
# Via Nix (temporário)
nix-shell -p gh

# Verificar PATH
which gh
echo $PATH
```

### Ver logs detalhados

```bash
# Habilitar debug do gh
GH_DEBUG=1 gh repo create teste

# Debug do git
GIT_TRACE=1 git push
```

---

## Referências

- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub CLI Repository](https://github.com/cli/cli)
- [Git Documentation](https://git-scm.com/doc)
- [GitHub Docs](https://docs.github.com/)

---

## Resumo de Comandos

| Ação | Comando |
|------|---------|
| Instalar (Nix) | `nix-shell -p gh` |
| Autenticar | `gh auth login` |
| Criar repo | `gh repo create nome --public --source=. --push` |
| Clonar | `gh repo clone usuario/repo` |
| Status | `git status` |
| Adicionar | `git add -A` |
| Commit | `git commit -m "mensagem"` |
| Push | `git push` |
| Pull | `git pull` |
| Listar repos | `gh repo list` |
| Renomear repo | `gh repo rename novo-nome` |
