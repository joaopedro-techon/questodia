---
description: 'Task list for Questódia — Plataforma de Quiz Gamificado'
---

# Tasks: Questódia — Plataforma de Quiz Gamificado

**Input**: Design documents from `/specs/001-questodia-quiz/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/realtime-events.md, contracts/quiz-api.md, quickstart.md

**Tests**: NÃO incluídos. A constituição (Princípio V) dispensa testes unitários; a validação é
funcional via `quickstart.md`.

**Organization**: Tarefas agrupadas por história de usuário para implementação e validação
independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: A qual história de usuário a tarefa pertence (US1, US2, US3, US4)
- Caminhos de arquivo exatos incluídos em cada descrição

## Path Conventions

- Projeto único web: backend Node em `server/` (com `db/`, `routes/`, `game/`) e frontend estático
  em `public/`, na raiz do repositório, conforme `plan.md`. Banco SQLite em `data/questodia.db`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do projeto e ferramentas de qualidade (Princípio IV).

- [x] T001 Criar a estrutura de pastas (`server/`, `server/db/`, `server/routes/`, `server/game/`, `public/`, `public/css/`, `public/js/`, `data/`) conforme `plan.md`
- [x] T002 Criar `package.json` na raiz com dependências (`express`, `socket.io`, `better-sqlite3`) e scripts `start`, `lint`, `format`
- [x] T003 [P] Configurar ESLint em `.eslintrc.json`
- [x] T004 [P] Configurar Prettier em `.prettierrc`
- [x] T005 [P] Definir constantes do jogo (capacidade máx. 200, pontos base, tamanhos dos códigos de gestão/sala, tempo padrão, caminho do banco) em `server/config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestrutura central (servidor, banco e base do jogo) que DEVE existir antes de qualquer história.

**⚠️ CRITICAL**: Nenhuma história de usuário pode começar antes desta fase concluir.

- [x] T006 Implementar o bootstrap do servidor Express + Socket.IO servindo `public/`, montando as rotas e expondo `GET /health` em `server/index.js`
- [x] T007 Implementar a conexão SQLite (abrir o arquivo, `PRAGMA foreign_keys = ON`, aplicar o schema no start) em `server/db/connection.js`
- [x] T008 [P] Definir o schema (tabelas `quizzes`, `questions`, `answer_options` com FKs em cascata) em `server/db/schema.sql`
- [x] T009 Implementar o modelo de estado da Partida em memória (mapa de jogadores, perguntas carregadas, `phase`, `currentQuestionIndex`, transições) em `server/game/room.js`
- [x] T010 Implementar o repositório de partidas em memória (criar/consultar/remover; gerar código de sala de 6 caracteres) em `server/game/room-store.js`
- [x] T011 Implementar o registro dos handlers de eventos por conexão (wiring master/jogador) em `server/game/events.js`
- [x] T012 [P] Criar a página inicial (escolher "Criar quiz" ou "Entrar") em `public/index.html`
- [x] T013 [P] Criar o wrapper compartilhado do cliente Socket.IO em `public/js/socket-client.js`
- [x] T014 [P] Criar a folha de estilo base gamificada em `public/css/styles.css`

**Checkpoint**: Servidor sobe, banco criado/migrado, partidas em memória podem ser criadas — histórias podem iniciar.

---

## Phase 3: User Story 1 - Master prepara um quiz com antecedência (Priority: P1) 🎯 MVP

**Goal**: Master cria, salva (SQLite) e edita quizzes com perguntas/respostas, recuperáveis por um código de gestão.

**Independent Test**: Criar/salvar um quiz com ≥ 2 perguntas, reiniciar o servidor, reabrir pelo código de gestão e confirmar que persiste e pode ser editado (Cenário 1 do `quickstart.md`).

### Implementation for User Story 1

- [x] T015 [US1] Implementar o repositório de quizzes (criar com código de gestão, buscar por código, substituir/editar em transação, listar) em `server/db/quiz-repository.js`
- [x] T016 [US1] Implementar a validação do payload de quiz (título não vazio; ≥ 1 pergunta; 2–4 opções; exatamente uma correta; tempo 5–120s) em `server/routes/quizzes.js`
- [x] T017 [US1] Implementar as rotas REST `POST`, `GET` e `PUT` de `/api/quizzes` (contrato `quiz-api.md`) em `server/routes/quizzes.js`
- [x] T018 [P] [US1] Construir a UI do montador de quiz (título, adicionar/editar/remover perguntas e opções, marcar a correta, salvar) em `public/host.html`
- [x] T019 [US1] Implementar a lógica do cliente do master para criar/editar/salvar quiz via REST e exibir o código/link de gestão em `public/js/host.js`

**Checkpoint**: O master consegue preparar, salvar e reabrir/editar um quiz que persiste entre reinícios.

---

## Phase 4: User Story 2 - Master lança e conduz uma partida ao vivo (Priority: P1) 🎯 MVP

**Goal**: Lançar uma partida a partir de um quiz salvo (gerando código de sala) e conduzi-la até o pódio.

**Independent Test**: Lançar uma partida de um quiz salvo, avançar as perguntas até o fim e verificar o pódio final (Cenário 1b do `quickstart.md`).

### Implementation for User Story 2

- [x] T020 [US2] Implementar o handler `host:launchRoom` (carregar o quiz do SQLite pelo código de gestão e criar a partida em memória com cópia das perguntas) em `server/game/events.js`
- [x] T021 [US2] Implementar o handler `host:startGame` (fase `lobby`→`question`, broadcast `game:question`) em `server/game/events.js`
- [x] T022 [US2] Implementar o cronômetro da pergunta e o encerramento automático por tempo, com broadcast `game:reveal` (opção correta + distribuição para o master) em `server/game/room.js` e `server/game/events.js`
- [x] T023 [US2] Implementar os handlers `host:nextQuestion` e `host:endGame` (avançar/finalizar partida) em `server/game/events.js`
- [x] T024 [US2] Implementar a lógica do cliente do master para lançar a partida do quiz salvo e conduzi-la (renderizar pergunta e reveal, avançar) em `public/js/host.js`

**Checkpoint**: O master lança e conduz uma partida completa a partir de um quiz salvo.

---

## Phase 5: User Story 3 - Jogador entra com nickname e responde (Priority: P1) 🎯 MVP

**Goal**: Jogador entra apenas com nickname + código de sala, responde às perguntas e recebe pontos por acerto e rapidez.

**Independent Test**: Entrar em uma sala só com nickname, responder dentro do tempo e verificar que a pontuação reflete correção + rapidez (Cenários 2 e 3 do `quickstart.md`).

### Implementation for User Story 3

- [x] T025 [US3] Implementar o modelo de Jogador e o handler `player:join` (unicidade de nickname por partida com rejeição `nickname_taken`, limite de 200, token de reconexão, aceitar entrada tardia na fase `question` iniciando com 0 pontos) em `server/game/room.js` e `server/game/events.js`
- [x] T026 [US3] Implementar o módulo de pontuação (pontos = acerto + rapidez com piso; ordenação do ranking e desempate por menor tempo total de resposta) em `server/game/scoring.js`
- [x] T027 [US3] Implementar o handler `player:answer` (registrar resposta imutável, validar fase/tempo) e integrar a pontuação no reveal em `server/game/events.js` e `server/game/room.js`
- [x] T028 [US3] Emitir `lobby:update` ao entrar e o `PlayerStateSnapshot` para reconexão em `server/game/events.js`
- [x] T029 [P] [US3] Construir a interface do jogador (formulário de entrada, tela de espera, pergunta/resposta) em `public/play.html`
- [x] T030 [US3] Implementar a lógica do cliente do jogador (entrar, persistir token no `localStorage`, responder, tratar reveal) em `public/js/play.js`

**Checkpoint**: Jogadores entram, respondem e são pontuados — MVP jogável de ponta a ponta (US1+US2+US3).

---

## Phase 6: User Story 4 - Experiência gamificada e feedback em tempo real (Priority: P2)

**Goal**: Feedback imediato por jogador, ranking parcial entre perguntas e pódio comemorativo de 1º/2º/3º.

**Independent Test**: Após cada pergunta, o jogador vê acerto/pontos/posição; ao final, o pódio destaca os 3 primeiros com desempate correto (Cenários 4 e 5 do `quickstart.md`).

### Implementation for User Story 4

- [x] T031 [US4] Estender o payload `game:reveal` com feedback individual (`you`: correto, pontos ganhos) e ranking parcial por jogador em `server/game/events.js`
- [x] T032 [US4] Implementar o cálculo do pódio (top 3 com desempate) e o broadcast `game:podium` em `server/game/scoring.js` e `server/game/events.js`
- [x] T033 [P] [US4] Adicionar a UI de feedback do reveal e ranking parcial na tela do jogador em `public/js/play.js` e `public/css/styles.css`
- [x] T034 [P] [US4] Adicionar a tela comemorativa de pódio (1º/2º/3º) no master e no jogador em `public/host.html`, `public/play.html` e `public/js/host.js`
- [x] T035 [US4] Tratar casos de borda na UI: menos de 3 jogadores pontuados e exibição de empates em `public/js/play.js` e `public/js/host.js`

**Checkpoint**: Experiência gamificada completa com feedback, ranking parcial e pódio.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Robustez, qualidade de código e validação final.

- [x] T036 [P] Tratar desconexão do master (`room:closed`/preservar partida) e reconexão de jogadores em `server/game/events.js`
- [x] T037 [P] Implementar a rota opcional `DELETE /api/quizzes/:managementCode` em `server/routes/quizzes.js`
- [x] T038 Rodar `npm run format` e `npm run lint` e corrigir apontamentos (Constituição, Princípio IV)
- [x] T039 Executar os cenários de validação do `quickstart.md` de ponta a ponta e registrar os resultados
- [x] T040 [P] (Opcional) Validar a capacidade (SC-003/FR-016) com um script de carga leve que abre ~200 conexões Socket.IO simuladas, entra na sala e responde, medindo o tempo até o reveal (≤3s, SC-004), em `scripts/loadtest.js`

---

## Phase 8: Melhorias solicitadas (painel + navegação + identidade Itaú)

**Purpose**: Painel de quizzes, navegação e reidentidade visual do Itaú Unibanco.

- [x] T041 Implementar `listQuizzes()` no repositório e a rota `GET /api/quizzes` (FR-023) em `server/db/quiz-repository.js` e `server/routes/quizzes.js`
- [x] T042 Criar a página "Meus Quizzes" (listar, editar, lançar) em `public/quizzes.html` e `public/js/quizzes.js`; link a partir da tela inicial
- [x] T043 Adicionar botões "Voltar ao início" (e "Meus quizzes") nas telas (FR-025) em `public/index.html`, `public/host.html`, `public/play.html`, `public/quizzes.html`
- [x] T044 Aplicar a identidade visual (tema gamificado tipo Kahoot) + selo Itaú Unibanco (FR-024) em `public/css/styles.css` e cabeçalhos de marca das páginas
- [x] T045 Gerar QR code de entrada no lobby (FR-026): rota `GET /api/qrcode` (`server/routes/qrcode.js`, dep `qrcode`) e exibição no `public/host.html` + `public/js/host.js` apontando para `/play.html?code=<sala>`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências.
- **Foundational (Phase 2)**: Depende do Setup — BLOQUEIA todas as histórias.
- **US1 (Phase 3, P1)**: Após a Foundational. Persistência de quizzes; base para o fluxo do master.
- **US2 (Phase 4, P1)**: Depende de US1 (precisa de um quiz salvo para lançar) + Foundational.
- **US3 (Phase 5, P1)**: Após a Foundational. Independente de US1/US2 no servidor; integra no reveal.
- **US4 (Phase 6, P2)**: Depende de US2 e US3 (usa reveal, ranking e pódio).
- **Polish (Phase 7)**: Depende das histórias desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: Fundamento de persistência do master.
- **US2 (P1)**: Requer US1 (lança a partir de quiz salvo).
- **US3 (P1)**: Testável de forma independente; pode ser desenvolvida em paralelo a US1/US2.
- **US4 (P2)**: Requer US2 + US3.

### Within Each User Story

- Persistência/estado antes dos handlers; handlers antes da UI que os consome.
- Tarefas no mesmo arquivo são sequenciais (sem `[P]`); arquivos diferentes marcados `[P]`.

### Parallel Opportunities

- Setup: T003, T004, T005 em paralelo.
- Foundational: T008 (schema) em paralelo a T006–T007; T012, T013, T014 em paralelo.
- US1: T018 (`host.html`) em paralelo às tarefas de servidor (T015–T017).
- US3: T029 (`play.html`) em paralelo aos handlers de servidor (T025–T028).
- US3 pode avançar em paralelo a US1/US2 (arquivos de servidor majoritariamente distintos).
- US4: T033 e T034 em paralelo (arquivos de front distintos).

---

## Parallel Example: User Story 1

```bash
# Após a Foundational, a UI do montador de quiz roda em paralelo às rotas/repositório:
Task: "T018 [US1] Construir a UI do montador de quiz em public/host.html"
Task: "T015 [US1] Implementar o repositório de quizzes em server/db/quiz-repository.js"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — todas P1)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational).
2. Concluir US1 (preparar/salvar quiz), US2 (lançar/conduzir) e US3 (jogador responde).
3. **PARAR e VALIDAR**: rodar os Cenários 1–3 do `quickstart.md`. Fluxo completo: preparar quiz →
   lançar partida → jogadores respondem → resultado.

### Incremental Delivery

1. Setup + Foundational → base pronta (servidor + banco).
2. US1 → quizzes persistidos e editáveis.
3. US2 → lançar e conduzir partidas a partir dos quizzes.
4. US3 → jogadores entram, respondem e pontuam (MVP jogável).
5. US4 → gamificação (feedback, ranking parcial, pódio).
6. Polish → robustez de conexão, rota de exclusão, lint/format e validação final.

---

## Notes

- [P] = arquivos diferentes, sem dependências pendentes.
- Sem tarefas de teste unitário por decisão da constituição (Princípio V); validar via `quickstart.md`.
- Persistência apenas dos quizzes; estado da partida ao vivo permanece em memória.
- O código de gestão é um segredo do master; nunca exposto aos jogadores (só o código de sala é público).
- Manter funções pequenas e nomes claros (Princípios II e III) durante a implementação.
- Commit após cada tarefa ou grupo lógico.
