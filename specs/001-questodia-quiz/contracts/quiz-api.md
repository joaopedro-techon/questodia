# Contract: API REST de Quizzes (preparação com antecedência)

**Feature**: 001-questodia-quiz | **Date**: 2026-07-21

Esta API cobre a **criação, leitura e edição de quizzes persistidos** (SQLite) — o que o master
prepara com antecedência (US1). O lançamento de partidas ao vivo e o jogo em si usam eventos
Socket.IO ([realtime-events.md](./realtime-events.md)).

- Base path: `/api/quizzes`
- Corpo e respostas em **JSON** (`Content-Type: application/json`).
- Autenticação: **nenhuma conta**. O acesso a um quiz existente exige o **código de gestão** secreto
  na URL. Quem possui o código pode ler/editar aquele quiz.

## Modelo de payload do Quiz

```json
{
  "title": "Capitais do Mundo",
  "questions": [
    {
      "text": "Qual a capital do Brasil?",
      "timeLimitSec": 20,
      "options": [
        { "text": "São Paulo", "isCorrect": false },
        { "text": "Brasília", "isCorrect": true },
        { "text": "Rio de Janeiro", "isCorrect": false }
      ]
    }
  ]
}
```

**Regras de validação** (retornam `400` com `{ "error": "validation", "details": [...] }`):

- `title`: string não vazia.
- `questions`: ao menos 1.
- Cada `question.text`: não vazia; `timeLimitSec`: inteiro entre 5 e 120.
- Cada `question.options`: 2 a 4 itens; texto não vazio; **exatamente uma** com `isCorrect: true`.

---

## Endpoints

### `GET /api/quizzes`

Lista resumida de todos os quizzes salvos (painel "Meus Quizzes" do master — permite recuperar um
código de gestão perdido).

- **200 OK**:
  ```json
  [
    {
      "id": 2,
      "title": "Onboarding",
      "managementCode": "qz_817760b4df683530",
      "questionCount": 2,
      "createdAt": "2026-07-21T22:00:00.000Z",
      "updatedAt": "2026-07-21T22:10:00.000Z"
    }
  ]
  ```
- Ordenado por `updatedAt` decrescente.

> **Nota de segurança**: esta rota expõe os códigos de gestão. Para o Questódia (ferramenta interna
> do Itaú Unibanco, com um único perfil de master) isso é aceitável e resolve a recuperação de
> códigos perdidos. Se no futuro houver múltiplos masters isolados, esta rota deve passar a exigir
> autenticação.

### `POST /api/quizzes`

Cria e persiste um novo quiz. Gera o código de gestão.

- **Body**: modelo de payload do Quiz (acima).
- **201 Created**:
  ```json
  {
    "id": 12,
    "managementCode": "qz_9f3k2m8x1a",
    "manageUrl": "/host.html?code=qz_9f3k2m8x1a",
    "title": "Capitais do Mundo",
    "questionCount": 5
  }
  ```
- **400**: erro de validação.

### `GET /api/quizzes/:managementCode`

Retorna o quiz completo para edição/lançamento.

- **200 OK**: o modelo de payload do Quiz, incluindo `id`, `managementCode`, `createdAt`,
  `updatedAt` e, em cada pergunta/opção, seus `id`s persistidos e `position`.
- **404**: `{ "error": "quiz_not_found" }`.

### `PUT /api/quizzes/:managementCode`

Substitui o conteúdo do quiz (título + perguntas/opções). Persiste as alterações (FR-021).

- **Body**: modelo de payload do Quiz (versão completa desejada).
- **200 OK**: mesmo formato do `GET`, já atualizado (`updatedAt` renovado).
- **400**: erro de validação. **404**: `{ "error": "quiz_not_found" }`.

> Semântica de substituição total (replace): perguntas/opções ausentes no body são removidas do
> quiz. Simplifica o cliente (envia o estado desejado) e o servidor (regrava em transação).

### `DELETE /api/quizzes/:managementCode` _(opcional nesta versão)_

Remove o quiz. Não afeta partidas ao vivo já em andamento (elas usam a cópia em memória).

- **204 No Content** em sucesso; **404** se inexistente.

---

## Erros comuns

| HTTP | `error`          | Significado                                 |
| ---- | ---------------- | ------------------------------------------- |
| 400  | `validation`     | Corpo não atende às regras (ver `details`). |
| 404  | `quiz_not_found` | Código de gestão inexistente.               |
| 500  | `internal`       | Falha inesperada de persistência.           |

## Relação com o tempo real

O `managementCode` obtido aqui é o mesmo passado em `host:launchRoom`
([realtime-events.md](./realtime-events.md)) para iniciar uma partida ao vivo a partir do quiz
salvo. O código de sala (join) para os jogadores é gerado nesse lançamento e é distinto do código de
gestão.
