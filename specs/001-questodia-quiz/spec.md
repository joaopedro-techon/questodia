# Feature Specification: Questódia — Plataforma de Quiz Gamificado

**Feature Branch**: `001-questodia-quiz`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Quero que você crie uma aplicação estilo kahoot para perguntas e respostas. A ideia é ter uma plataforma no qual vários usuários podem se logar apenas com o nickname. Um master irá preparar a sala com várias perguntas e várias respostas. Quem responder mais rápido e correto, ganha mais pontos. No final, fica no pódio quem tiver mais pontos. Quero que tenha primeiro, segundo e terceiro lugar no pódio. Quero algo gamificado estilo a plataforma do kahoot que já existe hoje no mercado. O aplicativo deve ser acessado através da web e deve suportar até 200 usuários. O nome do aplicativo será 'Questódia'."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Master prepara um quiz com antecedência (Priority: P1)

O organizador (master) monta com antecedência um quiz: um conjunto de perguntas de múltipla escolha
com suas respostas, indicando qual é a correta e o tempo de cada pergunta. Esse quiz é **salvo** e
sobrevive a reinícios do servidor. O master recebe um **código/link de gestão** que permite reabrir,
editar e, mais tarde, lançar o quiz — sem precisar de conta ou senha.

**Why this priority**: Poder preparar o conteúdo com antecedência é um requisito central do master:
sem persistência, todo quiz precisaria ser recriado do zero a cada partida. É o alicerce sobre o
qual a condução ao vivo (US2) acontece.

**Independent Test**: Pode ser testado criando e salvando um quiz com pelo menos 2 perguntas,
reiniciando o servidor, reabrindo o quiz pelo código de gestão e confirmando que perguntas e
respostas continuam lá e podem ser editadas.

**Acceptance Scenarios**:

1. **Given** o master está na tela inicial, **When** ele cria um novo quiz e adiciona perguntas com
   opções de resposta marcando a correta e o tempo, **Then** o quiz é salvo e o master recebe um
   código/link de gestão único.
2. **Given** um quiz salvo, **When** o master abre o código/link de gestão (mesmo após reiniciar o
   servidor), **Then** ele vê o quiz com todas as perguntas e respostas e pode editá-las.
3. **Given** um quiz salvo, **When** o master edita, adiciona ou remove perguntas/opções, **Then**
   as alterações são persistidas e refletidas nas próximas partidas lançadas a partir dele.

---

### User Story 2 - Master lança e conduz uma partida ao vivo (Priority: P1)

A partir de um quiz salvo, o master lança uma partida ao vivo, que recebe um **código de sala** para
os jogadores entrarem. O master controla o avanço das perguntas e acompanha, em tempo real, quem
está respondendo e a pontuação acumulada, até chegar ao pódio final.

**Why this priority**: É o momento em que o quiz preparado vira uma experiência jogável. Junto com
US1 e US3 forma o produto ao vivo.

**Independent Test**: Pode ser testado lançando uma partida a partir de um quiz salvo, avançando as
perguntas até o fim e verificando que o pódio final é exibido com base nas pontuações.

**Acceptance Scenarios**:

1. **Given** um quiz salvo, **When** o master o lança, **Then** uma partida ao vivo é criada com um
   código de sala único e fica pronta para receber jogadores.
2. **Given** uma partida com jogadores conectados, **When** o master inicia, **Then** a primeira
   pergunta é apresentada simultaneamente a todos os jogadores.
3. **Given** uma pergunta em andamento, **When** o tempo se esgota ou todos respondem, **Then** o
   master vê o resultado da pergunta (contagem por opção e a correta) e pode avançar.
4. **Given** a última pergunta foi encerrada, **When** o master finaliza a partida, **Then** o pódio
   com 1º, 2º e 3º lugares é exibido de acordo com a pontuação total.

---

### User Story 3 - Jogador entra com nickname e responde (Priority: P1)

Um participante acessa a plataforma pela web, informa apenas um nickname e o código da sala, e
passa a responder às perguntas apresentadas. Respostas corretas e rápidas rendem mais pontos.

**Why this priority**: A participação dos jogadores é a outra metade indispensável do núcleo.
Sem jogadores respondendo, a partida não tem sentido. Junto com US1 e US2 forma o MVP.

**Independent Test**: Pode ser testado entrando em uma sala existente apenas com um nickname,
respondendo a uma pergunta dentro do tempo e verificando que a pontuação é atribuída conforme a
correção e a rapidez da resposta.

**Acceptance Scenarios**:

1. **Given** um código de sala válido, **When** o jogador informa um nickname e entra, **Then**
   ele é adicionado à sala e aguarda o início da partida.
2. **Given** uma pergunta é apresentada, **When** o jogador seleciona uma opção antes do tempo
   acabar, **Then** a escolha é registrada e ele aguarda o resultado sem poder alterá-la.
3. **Given** o jogador respondeu corretamente, **When** o resultado da pergunta é calculado,
   **Then** ele recebe pontos proporcionais à rapidez da resposta (mais rápido = mais pontos).
4. **Given** o jogador respondeu incorretamente ou não respondeu, **When** o resultado é
   calculado, **Then** ele não recebe pontos naquela pergunta.

---

### User Story 4 - Experiência gamificada e feedback em tempo real (Priority: P2)

Entre as perguntas, os jogadores veem feedback imediato (acertou/errou, pontos ganhos, posição
atual) e um placar parcial (ranking) que aumenta o engajamento, no estilo das plataformas de quiz
já existentes no mercado.

**Why this priority**: Eleva a experiência de "funcional" para "gamificada e divertida", que é um
pedido explícito, mas a partida ainda funciona sem esses elementos. Por isso P2.

**Independent Test**: Pode ser testado verificando que, após cada pergunta, o jogador vê se
acertou, quantos pontos ganhou e sua posição no ranking parcial, e que o master vê o placar
atualizado.

**Acceptance Scenarios**:

1. **Given** uma pergunta foi encerrada, **When** o resultado é exibido, **Then** o jogador vê se
   acertou, os pontos ganhos e sua posição atual no ranking.
2. **Given** a partida está em andamento, **When** uma pergunta termina, **Then** um ranking
   parcial dos jogadores com maior pontuação é exibido antes da próxima pergunta.
3. **Given** a partida terminou, **When** o pódio é exibido, **Then** os 3 primeiros colocados
   aparecem destacados com uma apresentação comemorativa (1º, 2º e 3º lugares).

---

### Edge Cases

- **Nickname duplicado**: se um jogador tenta usar um nickname já em uso na mesma partida, o sistema
  **impede** a entrada (erro `nickname_taken`) e pede outro nome, garantindo identificação única no
  ranking.
- **Empate na pontuação**: quando dois ou mais jogadores terminam com a mesma pontuação, o sistema
  aplica um critério de desempate determinístico (ex.: menor tempo total de resposta) para definir
  as posições do pódio.
- **Menos de 3 jogadores**: se a partida tiver menos de 3 participantes com pontuação, o pódio
  exibe apenas as posições disponíveis.
- **Jogador desconecta e reconecta**: um jogador que perde a conexão e retorna com o mesmo
  nickname recupera sua pontuação e volta ao estado atual da partida.
- **Jogador entra após o início**: jogadores atrasados **podem entrar** em uma partida já iniciada,
  começam com 0 pontos e participam apenas das perguntas restantes (sem reposição das anteriores).
- **Master sai/perde conexão**: a partida é **preservada em memória** até o master reconectar;
  nenhuma pontuação é perdida enquanto isso.
- **Ninguém responde uma pergunta**: a pergunta é encerrada pelo tempo e ninguém pontua, seguindo
  normalmente para a próxima.
- **Capacidade máxima atingida**: ao alcançar 200 participantes na sala, novas tentativas de
  entrada são recusadas com mensagem clara.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um master crie e **salve com antecedência** um quiz,
  composto por múltiplas perguntas de múltipla escolha e suas opções de resposta.
- **FR-002**: O sistema MUST **persistir** os quizzes (perguntas, opções e a indicação da opção
  correta) de forma que sobrevivam a reinícios do servidor e possam ser reutilizados em várias
  partidas.
- **FR-003**: O sistema MUST permitir que o master defina um tempo limite de resposta por pergunta.
- **FR-020**: O sistema MUST fornecer ao master um **código/link de gestão único** por quiz, que
  permita reabrir e editar o quiz posteriormente, sem exigir conta ou senha.
- **FR-021**: O sistema MUST permitir que o master **edite** um quiz salvo (adicionar, alterar ou
  remover perguntas e opções) antes de lançar uma partida, persistindo as alterações.
- **FR-022**: O sistema MUST permitir **lançar uma partida ao vivo a partir de um quiz salvo**,
  gerando um código de sala único para os jogadores entrarem, sem alterar o quiz original.
- **FR-004**: O sistema MUST permitir que jogadores entrem na sala informando apenas um nickname e
  o código da sala, sem cadastro, senha ou dados pessoais.
- **FR-005**: O sistema MUST garantir a identificação única de cada jogador dentro de uma mesma
  sala (tratamento de nicknames repetidos).
- **FR-006**: O sistema MUST apresentar cada pergunta simultaneamente a todos os jogadores
  conectados quando o master avança a partida.
- **FR-007**: O sistema MUST registrar a resposta de cada jogador e o instante em que ela foi dada,
  impedindo alterações após o envio.
- **FR-008**: O sistema MUST atribuir pontos apenas a respostas corretas, com pontuação maior para
  respostas mais rápidas (velocidade influencia a pontuação).
- **FR-009**: O sistema MUST manter e atualizar a pontuação acumulada de cada jogador ao longo da
  partida.
- **FR-010**: O sistema MUST exibir, ao final de cada pergunta, o resultado (opção correta e
  distribuição das respostas) para o master.
- **FR-011**: O sistema MUST fornecer feedback ao jogador após cada pergunta (acertou/errou e
  pontos ganhos) e sua posição no ranking parcial.
- **FR-012**: O sistema MUST exibir um ranking parcial entre as perguntas, ordenado pela pontuação
  acumulada.
- **FR-013**: O sistema MUST, ao final da partida, exibir um pódio com o 1º, 2º e 3º lugares
  destacados de forma comemorativa.
- **FR-014**: O sistema MUST aplicar um critério de desempate determinístico quando houver empate
  de pontuação nas posições do pódio.
- **FR-015**: O sistema MUST ser acessível via navegador web, sem instalação de aplicativo.
- **FR-016**: O sistema MUST suportar até 200 jogadores participando simultaneamente de uma
  partida.
- **FR-017**: O sistema MUST recusar novas entradas quando a sala atingir a capacidade máxima,
  informando o motivo ao jogador.
- **FR-018**: O sistema MUST permitir que um jogador que se reconecte com o mesmo nickname retome
  sua pontuação e o estado atual da partida.
- **FR-019**: O sistema MUST permitir que o master avance manualmente entre perguntas e finalize a
  partida.
- **FR-023**: O sistema MUST oferecer ao master um painel que **lista todos os quizzes salvos**
  (título, nº de perguntas, data e código de gestão), permitindo abrir/editar ou lançar cada um —
  inclusive para **recuperar um código de gestão perdido**.
- **FR-024**: A interface MUST identificar o produto como do **Itaú Unibanco** (selo/marca visível em
  todas as telas). O tema de cores adotado é o **estilo gamificado tipo Kahoot** (paleta violeta com
  destaques em rosa/magenta), por preferência do cliente, aplicado de forma consistente.
- **FR-025**: Todas as telas MUST oferecer uma forma clara de **retornar à tela inicial**.
- **FR-026**: Ao abrir uma partida, a tela do master MUST exibir um **QR code** que leva o jogador
  diretamente à tela de entrada da sala com o código já preenchido, restando apenas escolher o
  apelido. O código de sala e a URL de entrada também MUST continuar visíveis como alternativa.

### Key Entities _(include if feature involves data)_

**Persistidas (banco de dados)** — sobrevivem a reinícios e são reutilizáveis:

- **Quiz**: template salvo com antecedência pelo master. Possui um título, um código/link de gestão
  único e o conjunto de perguntas. Serve de base para lançar partidas ao vivo.
- **Pergunta**: pertence a um quiz; enunciado com um conjunto de opções de resposta, a indicação da
  opção correta, um tempo limite e a ordem dentro do quiz.
- **Opção de Resposta**: uma alternativa de uma pergunta, marcada como correta ou incorreta.

**Efêmeras (em memória)** — existem apenas durante a partida ao vivo:

- **Partida (Sessão ao vivo)**: instância lançada a partir de um Quiz. Possui um código de sala
  único, o estado atual (aguardando, em andamento, encerrada) e a lista de jogadores. Ao ser criada,
  carrega uma cópia das perguntas do quiz.
- **Master**: organizador que cria/edita quizzes e conduz a partida ao vivo.
- **Jogador**: participante identificado por um nickname dentro de uma partida; possui pontuação
  acumulada e histórico de respostas.
- **Resposta do Jogador**: registro da opção escolhida por um jogador para uma pergunta, com o
  instante do envio, usada para calcular acerto e pontuação por rapidez.
- **Pontuação/Ranking**: pontos acumulados por jogador na partida, base para o ranking parcial e o
  pódio final.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Uma partida completa (criar sala, jogadores entram, responder perguntas e ver o
  pódio) pode ser conduzida do início ao fim sem intervenção técnica.
- **SC-002**: Um jogador consegue entrar em uma sala e começar a responder em menos de 30 segundos
  a partir do momento em que recebe o código.
- **SC-003**: A plataforma sustenta 200 jogadores simultâneos em uma partida sem falhas de
  participação (todos conseguem entrar, responder e ser pontuados).
- **SC-004**: Após cada pergunta, o resultado e o ranking parcial aparecem para os jogadores em até
  3 segundos do encerramento da pergunta.
- **SC-005**: Ao final de 100% das partidas com 3 ou mais jogadores pontuados, o pódio exibe
  corretamente 1º, 2º e 3º lugares, com desempate consistente.
- **SC-006**: A pontuação reflete a regra "mais rápido e correto = mais pontos": entre dois
  jogadores que acertam a mesma pergunta, o que responde mais rápido recebe pontuação maior em
  100% dos casos.
- **SC-007**: Um quiz salvo permanece integralmente recuperável (todas as perguntas e respostas)
  pelo código de gestão após o reinício do servidor, em 100% dos casos.

## Assumptions

- As perguntas são de **múltipla escolha com uma única opção correta** (padrão do estilo Kahoot);
  formatos como múltiplas respostas corretas, verdadeiro/falso ou resposta aberta ficam fora do
  escopo desta versão.
- A partida é **síncrona e ao vivo**: todos os jogadores respondem à mesma pergunta ao mesmo tempo,
  sob controle do master.
- O login por nickname é **efêmero e sem autenticação**: não há contas persistentes, senhas nem
  recuperação de dados pessoais; a identidade vale apenas durante a partida.
- **Apenas os quizzes são persistidos**; o estado da partida ao vivo (jogadores, respostas e
  pontuações) permanece em memória e não sobrevive ao fim da partida ou ao reinício do servidor.
- O master **não tem conta**: o acesso a um quiz salvo se dá exclusivamente pela posse do
  **código/link de gestão**, que funciona como um segredo. Quem tiver o código pode editar/lançar o
  quiz; a perda do código significa perda de acesso àquele quiz.
- Jogadores que chegam **após o início** da partida podem entrar apenas nas perguntas restantes e
  começam com pontuação zero (não há reposição das perguntas já passadas).
- O critério de **desempate** padrão é o menor tempo total de resposta acumulado entre os jogadores
  empatados.
- O conteúdo das perguntas é criado pelo próprio master; a plataforma não fornece banco de
  perguntas pronto nesta versão.
- O número de opções por pergunta segue o padrão de mercado (tipicamente até 4 alternativas).
- O sistema é destinado a uso em **ambiente web moderno** (navegadores atuais de desktop e mobile).
