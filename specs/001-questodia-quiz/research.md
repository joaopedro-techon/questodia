# Research: Questódia — Decisões Técnicas

**Feature**: 001-questodia-quiz | **Date**: 2026-07-21

Este documento resolve as escolhas técnicas do plano. Nenhum marcador "NEEDS CLARIFICATION"
permaneceu na spec; as decisões abaixo consolidam as premissas em escolhas concretas alinhadas à
constituição (simplicidade, sem testes unitários).

## 1. Comunicação em tempo real

- **Decisão**: WebSocket via **Socket.IO** (servidor Node.js), com salas (rooms) nativas do
  Socket.IO para isolar cada partida.
- **Rationale**: O jogo é síncrono — todos os jogadores recebem a pergunta ao mesmo tempo e o
  servidor precisa empurrar (push) resultados/rankings. Socket.IO oferece broadcast por sala,
  reconexão automática e fallback, reduzindo código próprio (Princípio I). Suporta com folga 200
  conexões por partida em um único processo.
- **Alternatives considered**:
  - _WebSocket puro (`ws`)_: mais leve, mas exigiria reimplementar salas, reconexão e
    heartbeat — mais código para manter, contra o Princípio I.
  - _Polling HTTP / SSE_: polling gera latência e carga desnecessárias; SSE é unidirecional e
    complicaria o envio de respostas do jogador. Rejeitados.

## 2. Persistência (abordagem híbrida)

- **Decisão**: **Híbrida**. Os **quizzes** (perguntas, opções, resposta correta) são persistidos em
  **SQLite**; o **estado da partida ao vivo** (jogadores, respostas, pontuações) fica **em memória**.
- **Rationale**: O master precisa **preparar quizzes com antecedência** e reutilizá-los (novo
  requisito FR-001/002), o que exige persistência. Já o estado da partida é efêmero (Assumptions) e
  não se beneficia de banco. SQLite é a opção mais simples que atende ao requisito: é um arquivo
  local, sem servidor separado, sem processo extra para gerenciar — alinhado ao Princípio I.
- **Alternatives considered**:
  - _PostgreSQL/MySQL_: robustos, mas exigem subir e manter um servidor de banco — complexidade de
    infraestrutura desnecessária para a escala pedida. Rejeitado (YAGNI).
  - _MongoDB_: adicionaria um servidor NoSQL e outra dependência sem ganho para dados tabulares
    simples (quiz → perguntas → opções). Rejeitado.
  - _Persistir também a partida ao vivo_: não há requisito de histórico de partidas; persistir
    pontuações em tempo real adicionaria I/O no caminho crítico dos 200 jogadores. Rejeitado.

## 2a. Driver SQLite e acesso a dados

- **Decisão**: **better-sqlite3** com **SQL puro** (sem ORM); schema aplicado na inicialização a
  partir de `server/db/schema.sql`.
- **Rationale**: `better-sqlite3` é síncrono e simples de usar (sem callbacks/promises no acesso ao
  banco), o que mantém o código legível (Princípio II). SQL puro para 3 tabelas evita o peso e a
  curva de um ORM (Princípio I / YAGNI).
- **Alternatives considered**:
  - _ORM (Prisma/Sequelize/TypeORM)_: geração de schema e migrações úteis em projetos grandes, mas
    excessivo para 3 tabelas. Rejeitado.
  - _`node:sqlite` nativo_: ainda experimental e não estável no Node.js 20 LTS. Rejeitado por
    estabilidade.

## 2b. Código/link de gestão do quiz (acesso do master)

- **Decisão**: Ao salvar um quiz, o servidor gera um **código de gestão** aleatório e difícil de
  adivinhar (ex.: 10+ caracteres). O master usa esse código (ou um link que o contém) para reabrir,
  editar e lançar o quiz. **Sem contas nem senhas.**
- **Rationale**: Atende FR-020/021 preservando o princípio de login efêmero (sem autenticação da
  spec). O código funciona como um segredo portador (bearer): quem o possui tem acesso àquele quiz.
- **Alternatives considered**:
  - _Contas de master (login/senha)_: traria autenticação, hashing de senha e recuperação —
    complexidade grande contra o Princípio I e a premissa de simplicidade. Rejeitado.
  - _Somente no navegador (localStorage)_: perderia acesso ao trocar de dispositivo/limpar o
    navegador; não é uma persistência real do ponto de vista do master. Rejeitado.

> **Nota de segurança**: por ser um segredo portador, o código de gestão NÃO deve ser exposto aos
> jogadores. O código de sala (join) da partida ao vivo é separado e público.

## 3. Frontend

- **Decisão**: **HTML/CSS/JavaScript puro**, servido como arquivos estáticos pelo Express; três
  páginas (inicial, master, jogador) usando o cliente Socket.IO via CDN/estático.
- **Rationale**: A UI é enxuta (formulários, exibição de pergunta, ranking, pódio). Um framework
  - bundler adicionaria toolchain e build sem necessidade real (Princípio I). JS puro mantém o
    projeto legível e sem etapa de build.
- **Alternatives considered**:
  - _React/Vue_: produtividade em apps grandes, mas exigiria bundler e mais dependências para uma
    UI pequena. Rejeitado por YAGNI.

## 4. Identificação de jogador e reconexão

- **Decisão**: Jogador identificado por **nickname único por sala**; ao entrar, o servidor emite um
  `playerToken` (id efêmero) guardado no `localStorage` do navegador. Reconexão reenvia o token para
  recuperar pontuação e estado.
- **Rationale**: Atende FR-005 (unicidade) e FR-018 (reconexão) sem contas/senhas (login efêmero).
  Nicknames repetidos são rejeitados na entrada com mensagem clara.
- **Alternatives considered**:
  - _Somente nickname sem token_: reconexão não distinguiria um retorno legítimo de um novo
    jogador roubando o nome. Rejeitado.
  - _Contas persistentes_: contraria a premissa de login efêmero. Rejeitado.

## 5. Regra de pontuação (correto + rápido)

- **Decisão**: Pontuação por pergunta = **0 se errado**; se correto,
  `pontos = round(BASE * (tempoRestante / tempoLimite))` com um piso mínimo para acerto (ex.: 50%
  de BASE garantido ao acertar, os outros 50% proporcionais à rapidez).
- **Rationale**: Implementa "mais rápido e correto = mais pontos" (FR-008, SC-006) de forma
  determinística e fácil de entender/depurar. O piso evita que quem acerta no limite do tempo fique
  com quase nada, mantendo a experiência justa e gamificada.
- **Desempate**: menor **tempo total de resposta acumulado** entre empatados (Assumptions),
  aplicado nas posições do pódio (FR-014).
- **Alternatives considered**:
  - _Pontuação fixa por acerto_: não recompensa rapidez, viola FR-008. Rejeitado.
  - _Curva não linear (exponencial)_: mais difícil de explicar e depurar sem ganho claro para o
    MVP. Rejeitado (pode ser revisto depois).

## 6. Código da sala

- **Decisão**: Código curto **alfanumérico de 6 caracteres** (maiúsculas + dígitos), gerado
  aleatoriamente e verificado quanto a colisão no mapa de salas.
- **Rationale**: Fácil de digitar em dispositivos móveis (SC-002, entrar em < 30s) e espaço
  suficiente para as salas simultâneas esperadas.
- **Alternatives considered**:
  - _UUID_: longo demais para digitar. Rejeitado.
  - _Numérico de 4 dígitos_: alto risco de colisão/adivinhação. Rejeitado.

## 7. Capacidade e desempenho

- **Decisão**: Limite rígido de **200 jogadores por sala** (config), recusando entradas além disso
  (FR-016, FR-017). Um único processo Node.js atende ao alvo.
- **Rationale**: Broadcast por sala do Socket.IO com payloads pequenos (pergunta, opções, ranking)
  mantém a atualização dentro de 3s (SC-004) para 200 conexões em uma máquina modesta.
- **Alternatives considered**:
  - _Cluster/múltiplos processos + Redis adapter_: necessário só acima da escala pedida.
    Rejeitado por YAGNI.

## 8. Qualidade de código (constituição, Princípio IV)

- **Decisão**: **Prettier** (formatação) + **ESLint** (lint) configurados; script `npm run lint` e
  `npm run format`. Sem framework de testes (Princípio V).
- **Rationale**: Cumpre a exigência de formatação/lint automáticos da constituição sem introduzir
  suíte de testes não requerida.

## Resumo das escolhas

| Área              | Decisão                                              |
| ----------------- | ---------------------------------------------------- |
| Runtime           | Node.js 20 LTS                                       |
| Tempo real        | Socket.IO (salas por partida)                        |
| Servidor HTTP     | Express (estáticos + API de quizzes + healthcheck)   |
| Persistência      | SQLite (better-sqlite3, SQL puro) — apenas quizzes   |
| Estado da partida | Em memória, efêmero                                  |
| Acesso do master  | Código/link de gestão (bearer), sem contas           |
| Frontend          | HTML/CSS/JS puro (sem build)                         |
| Identidade        | Nickname único + token de reconexão                  |
| Pontuação         | Base proporcional ao tempo restante, piso ao acertar |
| Desempate         | Menor tempo total de resposta                        |
| Código de sala    | Alfanumérico de 6 caracteres                         |
| Capacidade        | 200 jogadores por sala                               |
| Qualidade         | Prettier + ESLint, sem testes unitários              |
