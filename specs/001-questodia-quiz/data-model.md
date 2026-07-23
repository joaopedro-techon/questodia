# Data Model: Questódia

**Feature**: 001-questodia-quiz | **Date**: 2026-07-21

O modelo tem **duas camadas**:

- **Persistida (SQLite)** — os **quizzes** preparados com antecedência; sobrevivem a reinícios.
- **Em memória** — o estado da **partida ao vivo**; efêmero, some ao fim da partida.

**Terminologia (padrão do projeto)**: o termo visível ao usuário é **"Partida"**; no código do
backend o objeto correspondente chama-se **`Room`** (é a mesma coisa). **"Código de sala"** =
código de join **público** distribuído aos jogadores; **"código de gestão"** = segredo do master
para editar/lançar um quiz. Evitar usar "sala" e "sessão" como sinônimos soltos.

## Diagrama de relações

```text
PERSISTIDO (SQLite)                         EM MEMÓRIA (partida ao vivo)
─────────────────────                       ─────────────────────────────
Quiz (1) ── (N) Question ── (N) AnswerOption
   │  managementCode                        Room (1) ── (N) Player
   │                                          │  (carregado a partir de um Quiz)
   └───────── lançar partida ───────────────▶ └── (N) PlayerAnswer (1 por Player por Question)
```

Ao **lançar** uma partida, o servidor lê o Quiz do SQLite e cria uma `Room` em memória com uma
**cópia** das perguntas/opções. Editar o Quiz depois disso não afeta partidas já em andamento.

---

## Camada persistida (SQLite)

Arquivo do banco: `data/questodia.db` (caminho em `server/config.js`). Schema aplicado na
inicialização a partir de `server/db/schema.sql`.

### Tabela `quizzes`

| Coluna            | Tipo                 | Regras / Notas                                                                |
| ----------------- | -------------------- | ----------------------------------------------------------------------------- |
| `id`              | INTEGER PK           | Autoincremento.                                                               |
| `title`           | TEXT NOT NULL        | Título do quiz; não vazio.                                                    |
| `management_code` | TEXT NOT NULL UNIQUE | Segredo portador para editar/lançar (FR-020); 10+ chars aleatórios. Indexado. |
| `created_at`      | TEXT NOT NULL        | Timestamp ISO de criação.                                                     |
| `updated_at`      | TEXT NOT NULL        | Timestamp ISO da última edição.                                               |

### Tabela `questions`

| Coluna           | Tipo             | Regras / Notas                        |
| ---------------- | ---------------- | ------------------------------------- |
| `id`             | INTEGER PK       | Autoincremento.                       |
| `quiz_id`        | INTEGER NOT NULL | FK → `quizzes.id`, ON DELETE CASCADE. |
| `text`           | TEXT NOT NULL    | Enunciado; não vazio.                 |
| `time_limit_sec` | INTEGER NOT NULL | 5–120s (FR-003). Padrão 20.           |
| `position`       | INTEGER NOT NULL | Ordem da pergunta no quiz (0-based).  |

### Tabela `answer_options`

| Coluna        | Tipo             | Regras / Notas                                      |
| ------------- | ---------------- | --------------------------------------------------- |
| `id`          | INTEGER PK       | Autoincremento.                                     |
| `question_id` | INTEGER NOT NULL | FK → `questions.id`, ON DELETE CASCADE.             |
| `text`        | TEXT NOT NULL    | Texto da alternativa; não vazio.                    |
| `is_correct`  | INTEGER NOT NULL | 0/1. Exatamente **uma** opção correta por pergunta. |
| `position`    | INTEGER NOT NULL | Ordem da opção (0-based).                           |

**Regras de validação (aplicadas no repositório/rotas antes de gravar)**:

- Um quiz gravável tem `title` não vazio e ≥ 1 pergunta.
- Cada pergunta tem 2–4 opções e **exatamente uma** com `is_correct = 1` (FR-002).
- `time_limit_sec` entre 5 e 120.
- `PRAGMA foreign_keys = ON` habilitado na conexão para o CASCADE funcionar.

---

## Camada em memória (partida ao vivo)

Estruturas de dados no processo do servidor; nada disto é gravado no SQLite.

### Room (Partida / Sessão ao vivo)

| Campo                  | Tipo                           | Regras / Notas                                                    |
| ---------------------- | ------------------------------ | ----------------------------------------------------------------- |
| `code`                 | string                         | Código de sala (join) único; 6 caracteres alfanuméricos. Público. |
| `quizId`               | number                         | Quiz de origem (referência de leitura).                           |
| `hostId`               | string                         | Id do socket do master.                                           |
| `players`              | Map<playerToken, Player>       | Máx. 200 (FR-016/017).                                            |
| `questions`            | LoadedQuestion[]               | **Cópia** das perguntas/opções do quiz no momento do lançamento.  |
| `phase`                | enum                           | `lobby` \| `question` \| `reveal` \| `finished`.                  |
| `currentQuestionIndex` | number                         | -1 no lobby; incrementa a cada pergunta.                          |
| `questionStartedAt`    | number \| null                 | Timestamp (ms) do início da pergunta atual.                       |
| `answersThisQuestion`  | Map<playerToken, PlayerAnswer> | Reiniciado a cada pergunta.                                       |

**LoadedQuestion** (cópia em memória): `{ id, text, timeLimitSec, options: [{ id, text }], correctOptionId }`.
O `correctOptionId` fica só no servidor; não é enviado ao jogador antes do reveal.

**Transições de fase (`phase`)**:

```text
lobby ──startGame──▶ question ──(tempo esgota | todos responderam)──▶ reveal
  ▲                                                                      │
  │                                                    nextQuestion (há mais)
  │                                                                      ▼
  └──────────────────────────────  question (próxima)  ◀────────────────┘
reveal ──(era a última pergunta)──▶ finished
```

**Regras**: iniciar exige `phase == lobby` e `questions.length >= 1`; avançar exige `phase == reveal`;
entrada de jogador só com `players.size < 200`.

### Player (Jogador)

| Campo                 | Tipo           | Regras / Notas                                             |
| --------------------- | -------------- | ---------------------------------------------------------- |
| `token`               | string         | Id efêmero gerado no ingresso; reconexão (FR-018).         |
| `nickname`            | string         | 1–20 chars; único por partida (case-insensitive) (FR-005). |
| `socketId`            | string \| null | Conexão atual; `null` se desconectado.                     |
| `score`               | number         | Pontuação acumulada; inicia em 0.                          |
| `totalResponseTimeMs` | number         | Soma dos tempos; base de desempate (FR-014).               |
| `connected`           | boolean        | Estado de conexão para exibição.                           |

### PlayerAnswer (Resposta do Jogador)

No máximo uma por jogador por pergunta (FR-007).

| Campo            | Tipo    | Regras / Notas                        |
| ---------------- | ------- | ------------------------------------- |
| `playerToken`    | string  | Autor da resposta.                    |
| `optionId`       | string  | Opção escolhida.                      |
| `answeredAtMs`   | number  | Timestamp do envio.                   |
| `responseTimeMs` | number  | `answeredAtMs - questionStartedAt`.   |
| `correct`        | boolean | Calculado no reveal.                  |
| `pointsAwarded`  | number  | Calculado no reveal (0 se incorreto). |

**Regras**: ignorar respostas fora da fase `question`, após o tempo, ou uma segunda resposta do
mesmo jogador (imutável — FR-007).

---

## Objetos derivados (não persistidos)

### RankingEntry

| Campo      | Tipo   | Notas                        |
| ---------- | ------ | ---------------------------- |
| `nickname` | string |                              |
| `score`    | number |                              |
| `rank`     | number | Posição 1..N após ordenação. |

**Ordenação**: por `score` desc.; empate por `totalResponseTimeMs` asc. (FR-014). O pódio usa as
3 primeiras entradas (ou menos, se houver menos jogadores pontuados).
