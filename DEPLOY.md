# Guia de Deploy — Questódia

Este guia leva o Questódia do seu computador até um **servidor remoto Linux (VPS)** rodando em
**Docker**, e depois (Fase 2) coloca um **domínio bonito com HTTPS** no lugar do IP.

- **Fase 1**: subir e gerenciar a aplicação no VPS, acessível por `http://SEU_IP:3100`.
- **Fase 2**: domínio próprio + HTTPS automático (ex.: `https://questodia.seu-dominio.com`).

Arquivos já incluídos no projeto para isso:

- `Dockerfile` — empacota a aplicação (build de dependências + imagem enxuta de runtime).
- `docker-compose.yml` — publica o app na porta **3100 do host** (configurável via
  `QUESTODIA_PORT`; internamente o container usa 3000) com um volume que **persiste os quizzes**
  (SQLite).
- `.dockerignore` — mantém a imagem pequena.
- `deploy/Caddyfile` e `deploy/docker-compose.prod.yml` — Fase 2 (proxy + HTTPS).

> **Por que Docker + volume?** Os quizzes ficam num arquivo SQLite. O volume `questodia-data`
> guarda esse arquivo **fora** do container, então você pode atualizar/reconstruir a aplicação sem
> perder os quizzes. O estado da partida ao vivo é em memória (efêmero, por design).

---

## Fase 1 — Rodar no VPS com Docker

### 0. Pré-requisitos

- Um VPS Linux (recomendado **Ubuntu 22.04 ou 24.04**). Provedores comuns: DigitalOcean, Hetzner,
  Vultr, AWS Lightsail/EC2, Contabo, Oracle Cloud.
- Recursos suficientes: para até ~200 jogadores, **1 vCPU e 1 GB de RAM** já atendem com folga
  (2 GB dá mais conforto durante o build da imagem).
- Acesso **SSH** ao servidor (usuário e IP fornecidos pelo provedor).
- Git instalado na sua máquina (para versionar/enviar o código).

### 1. Acessar o servidor

```bash
ssh root@SEU_IP        # ou o usuário fornecido pelo provedor
```

### 2. Segurança básica (recomendado)

Crie um usuário não-root e um firewall simples. (Se preferir, pode pular e usar root no início.)

```bash
# criar usuário e dar sudo
adduser deploy
usermod -aG sudo deploy

# firewall: libere SSH e a porta do app (3100 na Fase 1)
apt update && apt install -y ufw
ufw allow OpenSSH
ufw allow 3100/tcp
ufw enable
```

> Na Fase 2, quando o Caddy assumir as portas 80/443, você libera `80,443` e pode **fechar a 3100**.

### 3. Instalar o Docker

```bash
curl -fsSL https://get.docker.com | sh
# permitir usar docker sem sudo (opcional; requer relogar)
sudo usermod -aG docker $USER
```

Verifique: `docker --version` e `docker compose version`.

### 4. Enviar o código para o servidor

**Opção A — Git (recomendado):** suba o projeto para um repositório (GitHub/GitLab) e clone no
servidor:

```bash
git clone https://github.com/SEU_USUARIO/questodia.git
cd questodia
```

**Opção B — Cópia direta (sem repositório):** da sua máquina (Windows, no Git Bash/PowerShell),
envie os arquivos com `rsync` ou `scp`. Não copie `node_modules` nem `data`:

```bash
# a partir da pasta do projeto, na sua máquina
rsync -av --exclude node_modules --exclude data --exclude .git ./ deploy@SEU_IP:/home/deploy/questodia/
```

### 5. Subir a aplicação

No servidor, dentro da pasta do projeto:

```bash
docker compose up -d --build
```

Isso constrói a imagem e sobe o container em segundo plano com `restart: unless-stopped`
(reinicia sozinho se cair ou se o servidor reiniciar).

### 6. Verificar

```bash
docker compose ps            # deve mostrar o container "questodia" como running/healthy
curl http://localhost:3100/health   # {"status":"ok"}
```

No navegador: `http://SEU_IP:3100`. Crie um quiz, lance a partida e teste o QR code.

> **QR code / celulares:** o QR aponta para o endereço que aparece na barra do navegador. Se você
> acessa por `http://SEU_IP:3100`, os celulares precisam estar na mesma rede/alcance desse IP. Na
> Fase 2, com domínio + HTTPS, o QR passa a apontar para `https://seu-dominio...`, acessível de
> qualquer lugar.

### 7. Gerenciar o dia a dia

```bash
# ver logs (ao vivo)
docker compose logs -f questodia

# reiniciar
docker compose restart questodia

# parar / subir
docker compose down
docker compose up -d

# ATUALIZAR após mudar o código (git pull ou novo rsync) — rebuild sem perder os quizzes:
git pull                       # ou reenvie via rsync
docker compose up -d --build
```

### 8. Backup e restauração dos quizzes (SQLite)

Os quizzes vivem no volume `questodia-data`. Para fazer backup do arquivo do banco:

```bash
# copia o banco de dentro do container para o servidor
docker compose cp questodia:/data/questodia.db ./questodia-backup-$(date +%F).db
```

Para restaurar, pare o app, copie o arquivo de volta e suba de novo:

```bash
docker compose down
docker compose up -d
docker compose cp ./questodia-backup-2026-07-23.db questodia:/data/questodia.db
docker compose restart questodia
```

> Dica: agende o backup com um `cron` diário copiando o `.db` para um local seguro (ou storage
> externo).

---

## Fase 2 — Domínio bonito + HTTPS

Objetivo: trocar `http://SEU_IP:3100` por algo como `https://questodia.seu-dominio.com`, com
cadeado (HTTPS) e sem porta na URL. Usaremos o **Caddy** como proxy reverso — ele **obtém e renova
o certificado TLS automaticamente** (Let's Encrypt) e já lida com WebSocket (Socket.IO), sem
configuração extra.

### 1. Registrar um domínio

Compre um domínio em um registrador (ex.: Registro.br para `.com.br`, ou Namecheap/Cloudflare/
GoDaddy para `.com`). Você pode usar o domínio raiz (`questodia.com`) ou um subdomínio
(`questodia.suaempresa.com`).

### 2. Apontar o DNS para o servidor

No painel de DNS do domínio, crie um registro **A**:

| Tipo | Nome (host) | Valor | TTL |
|------|-------------|-------|-----|
| A | `questodia` (ou `@` para o domínio raiz) | `SEU_IP` | automático |

A propagação costuma levar de minutos a algumas horas. Teste com:

```bash
ping questodia.seu-dominio.com     # deve resolver para SEU_IP
```

### 3. Liberar as portas 80 e 443

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# opcional: fechar a 3100, já que o acesso passa a ser pelo Caddy
sudo ufw delete allow 3100/tcp
```

### 4. Configurar o domínio no Caddy

Edite `deploy/Caddyfile` e troque o placeholder pelo seu domínio real:

```
questodia.seu-dominio.com {
    encode gzip
    reverse_proxy questodia:3000
}
```

### 5. Subir com o compose de produção (app + Caddy)

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

O Caddy sobe nas portas 80/443, resolve o certificado HTTPS na primeira requisição e faz o proxy
para o container do Questódia (que agora não expõe a 3000 ao mundo).

### 6. Verificar

Acesse `https://questodia.seu-dominio.com` — deve abrir com cadeado. Lance uma partida e confirme
que o **QR code** agora aponta para o domínio (funciona de qualquer celular com internet).

### Gerenciamento na Fase 2

Mesmos comandos, apontando para o arquivo de produção:

```bash
docker compose -f deploy/docker-compose.prod.yml logs -f
docker compose -f deploy/docker-compose.prod.yml up -d --build   # atualizar
docker compose -f deploy/docker-compose.prod.yml down            # parar tudo
```

---

## Referência rápida

| Ação | Comando |
|------|---------|
| Subir (Fase 1) | `docker compose up -d --build` |
| Subir (Fase 2) | `docker compose -f deploy/docker-compose.prod.yml up -d --build` |
| Ver logs | `docker compose logs -f questodia` |
| Reiniciar | `docker compose restart questodia` |
| Atualizar código | `git pull && docker compose up -d --build` |
| Backup do banco | `docker compose cp questodia:/data/questodia.db ./backup.db` |
| Status/saúde | `docker compose ps` · `curl localhost:3100/health` |

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `QUESTODIA_PORT` | `3100` | Porta do **host** publicada pelo compose (mude se já estiver em uso). |
| `PORT` | `3000` | Porta HTTP **interna** do container (normalmente não precisa mudar). |
| `DB_PATH` | `/data/questodia.db` (no container) | Caminho do arquivo SQLite (fica no volume). |

Para usar outra porta do host sem editar arquivos:

```bash
QUESTODIA_PORT=3200 docker compose up -d --build
```

## Notas

- **Não há segredos/credenciais** a configurar nesta versão — o login é efêmero por nickname.
- O **código de gestão** dos quizzes é um segredo do master; ao expor o app publicamente, lembre-se
  de que a página "Meus Quizzes" lista esses códigos (ver nota de segurança no contrato). Para uso
  interno do Itaú Unibanco com um único master, isso é aceitável.
- Se o build do `better-sqlite3` falhar em algum ambiente, o `Dockerfile` usa a imagem completa
  `node:20-bookworm` no estágio de build (com compiladores), então a compilação nativa funciona
  mesmo sem binário pré-compilado.
