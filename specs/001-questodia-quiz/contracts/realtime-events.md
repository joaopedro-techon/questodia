# Contract: Eventos de Tempo Real (Socket.IO)

**Feature**: 001-questodia-quiz | **Date**: 2026-07-21

Este é o contrato de interface entre o frontend e o servidor. A comunicação é feita por eventos
Socket.IO. Convenções:

- **C→S** = emitido pelo cliente para o servidor. **S→C** = emitido pelo servidor para o cliente.
- Todo evento C→S pode receber um **callback de ack** `(response)` com
  `{ ok: true, ... }` ou `{ ok: false, error: "código_legível" }`.
- Cada partida usa uma **sala Socket.IO** nomeada pelo `code`. Broadcasts de jogo vão para a sala.

A **preparação de quizzes com antecedência** (criar/editar/persistir perguntas) é feita pela **API
REST** descrita em [quiz-api.md](./quiz-api.md), não por eventos de tempo real. Os eventos abaixo
tratam apenas da **partida ao vivo**, que é lançada a partir de um quiz já salvo.

Além destes eventos, o servidor expõe uma rota HTTP `GET /health` retornando `200 OK` para
verificação de disponibilidade.

---

## Eventos do Master (Host)

### `host:launchRoom` (C→S)

Lança uma partida ao vivo a partir de um quiz salvo (identificado pelo código de gestão). O servidor
carrega as perguntas do SQLite e cria a sala em memória.

- **Payload**: `{ "managementCode": "qz_9f3k2m8x1a" }`
- **Ack (sucesso)**: `{ ok: true, code: "AB12CD", quizTitle: "Capitais", questionCount: 5 }`
- **Ack (erro)**: `{ ok: false, error: "quiz_not_found" | "empty_quiz" }`
- **Efeito**: cria a sala na fase `lobby` com uma cópia das perguntas do quiz.

> O `managementCode` é secreto e NÃO deve ser compartilhado com jogadores. Aos jogadores divulga-se
> apenas o `code` (código de sala) retornado.

### `host:reattach` (C→S)

Reata o master a uma partida preservada em memória após recarregar a página ou reconectar (o
estado e as pontuações não são perdidos enquanto o master está fora — ver edge case "Master
sai/perde conexão").

- **Payload**: `{ "code": "AB12CD" }`
- **Ack**: `{ ok: true, phase, code, quizTitle }` | `{ ok: false, error: "room_not_found" }`

### `host:startGame` (C→S)

Inicia a partida (fase `lobby` → `question`, apresenta a 1ª pergunta).

- **Payload**: `{ "code": "AB12CD" }`
- **Precondição**: `questions.length >= 1`.
- **Ack**: `{ ok: true }` | `{ ok: false, error: "no_questions" | "not_lobby" }`
- **Efeito**: dispara `game:question` para a sala.

### `host:nextQuestion` (C→S)

Avança da fase `reveal` para a próxima pergunta, ou finaliza se era a última.

- **Payload**: `{ "code": "AB12CD" }`
- **Ack**: `{ ok: true, finished: false }` | `{ ok: true, finished: true }` | `{ ok: false, error }`
- **Efeito**: dispara `game:question` (próxima) ou `game:podium` (fim).

### `host:endGame` (C→S)

Encerra a partida a qualquer momento e mostra o pódio.

- **Payload**: `{ "code": "AB12CD" }`
- **Ack**: `{ ok: true }`
- **Efeito**: dispara `game:podium`.

---

## Eventos do Jogador (Player)

### `player:join` (C→S)

Entra em uma sala com nickname.

- **Payload**: `{ "code": "AB12CD", "nickname": "Ana", "playerToken": null }`
  - `playerToken` presente indica tentativa de **reconexão**.
- **Ack (sucesso)**: `{ ok: true, playerToken: "t_xyz", state: <PlayerStateSnapshot> }`
- **Ack (erro)**: `{ ok: false, error: "room_not_found" | "nickname_taken" | "room_full" }`
- **Efeito**: dispara `lobby:update` para a sala (lista de jogadores).

### `player:answer` (C→S)

Envia a resposta da pergunta atual.

- **Payload**: `{ "code": "AB12CD", "playerToken": "t_xyz", "optionId": "o2" }`
- **Regras**: aceito só na fase `question`, dentro do tempo, e apenas a primeira vez (FR-007).
- **Ack**: `{ ok: true, received: true }` | `{ ok: false, error: "too_late" | "already_answered" | "not_active" }`

---

## Eventos do Servidor (Broadcast / S→C)

### `lobby:update` (S→C)

Lista atual de jogadores no lobby.

- **Payload**: `{ "players": [ { "nickname": "Ana", "connected": true } ], "count": 1 }`

### `game:question` (S→C)

Apresenta uma pergunta a todos (sem revelar a correta).

- **Payload**:
  ```json
  {
    "index": 0,
    "total": 5,
    "text": "Qual a capital do Brasil?",
    "options": [
      { "id": "o1", "text": "São Paulo" },
      { "id": "o2", "text": "Brasília" }
    ],
    "timeLimitSec": 20,
    "serverStartMs": 1721580000000
  }
  ```

### `game:reveal` (S→C)

Encerra a pergunta e revela o resultado.

- **Payload**:
  ```json
  {
    "correctOptionId": "o2",
    "distribution": { "o1": 12, "o2": 180 },
    "you": { "correct": true, "pointsAwarded": 950 },
    "ranking": [{ "nickname": "Ana", "score": 950, "rank": 1 }]
  }
  ```
- **Notas**: `you` é personalizado por jogador (feedback individual — FR-011); `ranking` é o
  parcial (FR-012). Para o master, `you` pode ser omitido.

### `game:podium` (S→C)

Pódio final com os 3 primeiros (ou menos).

- **Payload**:
  ```json
  {
    "podium": [
      { "rank": 1, "nickname": "Ana", "score": 2800 },
      { "rank": 2, "nickname": "Bruno", "score": 2450 },
      { "rank": 3, "nickname": "Carla", "score": 2100 }
    ],
    "fullRanking": [{ "nickname": "Ana", "score": 2800, "rank": 1 }]
  }
  ```

### `player:kicked` / `room:closed` (S→C)

- **`room:closed`**: `{ "reason": "host_left" }` — sala encerrada; clientes voltam à tela inicial.

---

## PlayerStateSnapshot (usado na reconexão)

Retornado no ack de `player:join` para restaurar a tela do jogador ao estado atual:

```json
{
  "phase": "question",
  "score": 950,
  "currentQuestion": {
    "index": 2,
    "text": "...",
    "options": [],
    "timeLimitSec": 20,
    "serverStartMs": 0
  },
  "alreadyAnswered": false
}
```

## Códigos de erro (ack `error`)

| Código             | Significado                                       |
| ------------------ | ------------------------------------------------- |
| `quiz_not_found`   | Código de gestão inexistente ao lançar a partida. |
| `empty_quiz`       | Quiz salvo não possui perguntas para lançar.      |
| `room_not_found`   | Código de sala inexistente.                       |
| `nickname_taken`   | Nickname já em uso na sala.                       |
| `room_full`        | Sala atingiu 200 jogadores.                       |
| `no_questions`     | Tentou iniciar sem perguntas.                     |
| `not_lobby`        | Ação exige fase de lobby.                         |
| `not_active`       | Não há pergunta ativa.                            |
| `too_late`         | Resposta após o tempo limite.                     |
| `already_answered` | Jogador já respondeu esta pergunta.               |
| `not_host`         | Ação de master feita por quem não é o host.       |
