# Implementation Plan: Questódia — Plataforma de Quiz Gamificado

**Branch**: `001-questodia-quiz` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-questodia-quiz/spec.md`

## Summary

Questódia é uma aplicação web de quiz ao vivo no estilo Kahoot. Um master cria uma sala com
perguntas de múltipla escolha, jogadores entram apenas com um nickname usando um código de sala, e
todos respondem simultaneamente. A pontuação premia respostas corretas e rápidas, e a partida
termina com um pódio de 1º, 2º e 3º lugares. A abordagem técnica prioriza simplicidade (conforme a
constituição): um único serviço Node.js servindo uma interface web estática e coordenando o jogo em
tempo real via WebSocket, com estado da partida mantido em memória (partidas são efêmeras).

## Technical Context

**Language/Version**: JavaScript (Node.js 20 LTS) — sem etapa de build/transpilação para manter
simplicidade.

**Primary Dependencies**: Express (servir estáticos + API REST de quizzes + rota de saúde),
Socket.IO (comunicação em tempo real bidirecional entre master e jogadores), **better-sqlite3**
(driver SQLite síncrono para persistência de quizzes) e **qrcode** (geração do QR code de entrada no
lobby). Frontend em HTML/CSS/JavaScript puro (sem framework/bundler).

**Storage**: **Híbrido**. Os **quizzes** (perguntas, opções e resposta correta) são persistidos em
**SQLite** (arquivo local, sem servidor) para serem preparados com antecedência e reutilizados. O
**estado da partida ao vivo** (jogadores, respostas, pontuações) permanece **em memória**, pois é
efêmero e não sobrevive ao fim da partida.

**Testing**: Sem testes unitários (decisão da constituição, Princípio V). Validação funcional
manual via `quickstart.md`, exercitando a aplicação de ponta a ponta.

**Target Platform**: Navegadores web modernos (desktop e mobile); servidor Node.js único.

**Project Type**: Web application (backend em tempo real + frontend estático servido pelo mesmo
processo).

**Performance Goals**: Suportar 200 jogadores simultâneos por partida; resultado/ranking exibido em
até 3 segundos após o fim de cada pergunta (SC-004).

**Constraints**: Login efêmero apenas com nickname (sem contas/senhas); partida síncrona controlada
pelo master; sem persistência entre partidas; reconexão pelo mesmo nickname recupera o estado.

**Scale/Scope**: 1 partida ativa por sala; até 200 jogadores por sala; escopo de MVP das 3
histórias de usuário da spec.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Avaliação frente à Questódia Constitution v1.0.0:

- **I. Simplicidade Primeiro (KISS & YAGNI)**: ✅ PASS — stack mínima (Node + Express + Socket.IO +
  frontend puro). A persistência usa **SQLite** (arquivo local, sem servidor de banco nem ORM):
  a opção mais simples que atende ao requisito de preparar quizzes com antecedência. Estado da
  partida ao vivo segue em memória. Sem bundler. Nenhuma abstração além da necessária.
- **II. Código Legível e Autoexplicativo**: ✅ PASS — o design separa responsabilidades por arquivos
  com nomes claros (game state, scoring, socket handlers). A verificar durante a implementação.
- **III. Funções Pequenas e Responsabilidade Única**: ✅ PASS — cálculo de pontuação, gestão de
  estado da sala e handlers de eventos ficam isolados em módulos focados.
- **IV. Consistência e Formatação Automática**: ✅ PASS — Prettier + ESLint configurados como parte
  do setup (Phase 1 / tasks).
- **V. Validação Funcional em vez de Testes Unitários**: ✅ PASS — nenhum teste unitário exigido;
  `quickstart.md` define os passos de validação funcional ponta a ponta.

**Resultado**: Sem violações. Nenhuma entrada necessária em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-questodia-quiz/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── realtime-events.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
server/
├── index.js             # Ponto de entrada: Express + Socket.IO, serve /public, monta rotas
├── db/
│   ├── connection.js    # Abre a conexão SQLite e aplica o schema na inicialização
│   ├── schema.sql       # DDL: tabelas quizzes, questions, answer_options
│   └── quiz-repository.js # CRUD de quizzes (criar, buscar por código de gestão, editar, listar)
├── routes/
│   └── quizzes.js       # API REST para preparar/editar quizzes com antecedência
├── game/
│   ├── room-store.js    # Criação/consulta/remoção de partidas em memória; código de sala
│   ├── room.js          # Estado de uma partida ao vivo (jogadores, perguntas, fase atual)
│   ├── scoring.js       # Regra de pontuação por acerto + rapidez e desempate
│   └── events.js        # Registro dos handlers de eventos de tempo real (master/jogador)
└── config.js            # Constantes (capacidade máx. 200, pontos base, caminho do banco, etc.)

public/
├── index.html           # Tela inicial: criar sala (master) ou entrar (jogador)
├── host.html            # Interface do master: montar perguntas e conduzir a partida
├── play.html            # Interface do jogador: entrar, responder, ver feedback/pódio
├── css/
│   └── styles.css       # Estilo gamificado compartilhado
└── js/
    ├── socket-client.js # Wrapper fino sobre o cliente Socket.IO
    ├── host.js          # Lógica da tela do master
    └── play.js          # Lógica da tela do jogador

scripts/
└── loadtest.js          # (Opcional) Carga leve: ~200 conexões simuladas p/ validar SC-003/SC-004

data/
└── questodia.db         # Banco SQLite (criado no 1º start; fora do controle de versão)

package.json             # Dependências e scripts (start, lint, format)
.eslintrc.json           # Regras de lint (Princípio IV)
.prettierrc              # Formatação (Princípio IV)
```

**Structure Decision**: Aplicação web de projeto único com backend e frontend no mesmo repositório e
servidos pelo mesmo processo Node. `server/` concentra a persistência (`db/`), a API REST de quizzes
(`routes/`) e a lógica de tempo real e do jogo (`game/`); `public/` é o frontend estático (sem
build). A separação em `db/` (persistência de quizzes) e `game/` (partida ao vivo em memória)
reflete a fronteira entre o que é persistido e o que é efêmero, e isola pontuação e estado dos
handlers de socket, atendendo aos Princípios II e III sem introduzir camadas desnecessárias. O
arquivo SQLite fica em `data/questodia.db` (caminho configurável em `server/config.js`).

## Complexity Tracking

> Nenhuma violação da constituição. Seção não aplicável.
