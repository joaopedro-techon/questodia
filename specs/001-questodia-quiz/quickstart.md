# Quickstart & Validação Funcional: Questódia

**Feature**: 001-questodia-quiz | **Date**: 2026-07-21

Este guia mostra como rodar a aplicação e **validar funcionalmente** as histórias de usuário. Não
há testes unitários (constituição, Princípio V) — a corretude é verificada exercitando o app de
ponta a ponta.

## Pré-requisitos

- Node.js 20 LTS instalado (`node --version`).
- Ferramentas de build para módulos nativos do `better-sqlite3` (normalmente já presentes; no
  Windows, os "Build Tools"/Python podem ser necessários se o npm compilar do zero).
- Um navegador moderno. Para simular master + jogadores, use abas/janelas anônimas diferentes.

## Setup

```bash
# a partir da raiz do repositório
npm install
```

O banco **SQLite** é criado automaticamente na primeira execução em `data/questodia.db` (o schema
de `server/db/schema.sql` é aplicado no start). Não há passo de migração manual.

## Executar

```bash
npm start          # inicia o servidor (padrão: http://localhost:3000)
```

Verifique a saúde do servidor:

```bash
curl http://localhost:3000/health   # deve responder 200 OK
```

## Qualidade de código (constituição — Princípio IV)

```bash
npm run format     # aplica Prettier
npm run lint       # roda ESLint; deve terminar sem erros
```

---

## Cenários de validação

Referências: entidades em [data-model.md](./data-model.md); eventos em
[contracts/realtime-events.md](./contracts/realtime-events.md); API de quizzes em
[contracts/quiz-api.md](./contracts/quiz-api.md).

### Cenário 1 — Master prepara e salva um quiz, e ele persiste (US1)

1. Abra `http://localhost:3000` e escolha **Criar quiz (master)**.
2. Dê um título e cadastre **2 perguntas** de múltipla escolha, marcando a opção correta e o tempo.
3. Salve. Verifique que um **código/link de gestão** é exibido (guarde-o).
4. **Reinicie o servidor** (`Ctrl+C` e `npm start` de novo).
5. Abra o **link de gestão** e confirme que o quiz, com todas as perguntas/respostas, continua lá e
   pode ser **editado** (adicione/remova uma opção e salve).

**Esperado**: quiz persistido em SQLite; recuperável pelo código de gestão após reinício (SC-007);
edições são salvas.

### Cenário 1b — Lançar uma partida ao vivo a partir do quiz salvo (US2)

1. Na tela de gestão do quiz, clique em **Lançar partida**.
2. Verifique que um **código de sala de 6 caracteres** (join) é exibido — distinto do código de
   gestão.
3. Conduza a partida: iniciar, avançar as perguntas e finalizar até o pódio.

**Esperado**: partida criada a partir do quiz; código de sala público; condução até o pódio.

### Cenário 2 — Jogador entra com nickname e responde (US3)

1. Em outra aba, abra `http://localhost:3000`, escolha **Entrar**, informe o **código** e um
   **nickname**.
2. Tente entrar com o **mesmo nickname** em uma terceira aba → deve ser **recusado**
   (`nickname_taken`).
3. Com a partida iniciada pelo master, responda a uma pergunta **antes** do tempo acabar.
4. Tente **alterar** a resposta → deve ser recusado (`already_answered`).

**Esperado**: entrada só com nickname; unicidade garantida; resposta registrada e imutável.

### Cenário 3 — Pontuação por rapidez e acerto (US3 / SC-006)

1. Com **2 jogadores**, ambos respondem **corretamente** a mesma pergunta, um claramente mais
   rápido que o outro.
2. No reveal, compare os pontos.

**Esperado**: quem respondeu **mais rápido** recebe **mais pontos**; quem errou recebe **0**.

### Cenário 4 — Feedback e ranking em tempo real (US4 / SC-004)

1. Após cada pergunta, observe a tela do jogador.

**Esperado**: cada jogador vê **acertou/errou**, **pontos ganhos** e **posição** no ranking parcial,
em até ~3 segundos do fim da pergunta.

### Cenário 5 — Pódio final (US4 / SC-005)

1. Com **3+ jogadores** com pontuações diferentes, conclua todas as perguntas.
2. Observe a tela final.

**Esperado**: pódio destacando **1º, 2º e 3º** lugares. Repita com **empate** de pontuação e
confirme que o desempate usa o **menor tempo total de resposta**. Com menos de 3 jogadores
pontuados, o pódio mostra apenas as posições disponíveis.

### Cenário 6 — Reconexão (FR-018)

1. Durante a partida, **feche e reabra** a aba de um jogador (mesmo navegador, mesmo nickname).

**Esperado**: o jogador retorna com a **pontuação preservada** e no **estado atual** da partida.

### Cenário 7 — Capacidade máxima e carga (FR-016 / FR-017 / SC-003 / SC-004)

**7a. Recusa ao lotar (rápido, sem 200 abas)**

1. Configure temporariamente o limite para um valor baixo (ex.: 2) em `server/config.js` e tente
   entrar com um 3º jogador.

**Esperado**: entrada recusada com `room_full`. Reverta o limite para 200 após o teste.

**7b. Carga real de ~200 jogadores (opcional, via script)**

1. Com uma partida no lobby, rode o script de carga (tarefa T040):

   ```bash
   node scripts/loadtest.js --code AB12CD --players 200
   ```

2. O script abre ~200 conexões Socket.IO, entra na sala e responde às perguntas.

**Esperado**: todos os 200 entram e respondem sem erro (SC-003), e o reveal chega em ≤3s do fim de
cada pergunta (SC-004).

---

## Checklist de validação (marcar ao concluir)

- [ ] Servidor sobe, cria `data/questodia.db` e `/health` responde 200.
- [ ] `npm run lint` sem erros e `npm run format` aplicado.
- [ ] US1: criar/salvar quiz, persistir após reinício (SC-007) e editar pelo código de gestão.
- [ ] US2: lançar partida a partir do quiz salvo e conduzir até o fim.
- [ ] US3: entrar só com nickname; unicidade e imutabilidade da resposta.
- [ ] SC-006: mais rápido e correto = mais pontos; erro = 0.
- [ ] US4: feedback individual + ranking parcial em ~3s.
- [ ] Pódio com 1º/2º/3º e desempate por tempo.
- [ ] Reconexão preserva pontuação e estado.
- [ ] Capacidade máxima recusa entradas além do limite.
