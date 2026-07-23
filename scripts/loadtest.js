'use strict';

// Carga leve para validar SC-003 (200 jogadores) e SC-004 (reveal ≤3s).
// Uso: node scripts/loadtest.js --code AB12CD --players 200 [--url http://localhost:3000]
// Requer: npm install socket.io-client (devDependency).
//
// Fluxo: abre N conexões, entra na sala e, a cada game:question, responde na
// primeira opção. Mede o atraso entre receber a pergunta e receber o reveal.

const { io } = require('socket.io-client');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const code = arg('code');
const players = Number(arg('players', '200'));
const url = arg('url', 'http://localhost:3000');

if (!code) {
  console.error('Informe --code <CODIGO_DA_SALA>');
  process.exit(1);
}

let joined = 0;
let joinErrors = 0;
const revealDelays = [];

console.log(`Conectando ${players} jogadores simulados em ${url} (sala ${code})...`);

for (let i = 0; i < players; i += 1) {
  const socket = io(url, { transports: ['websocket'] });
  let lastQuestionAt = 0;

  socket.on('connect', () => {
    socket.emit('player:join', { code, nickname: `bot_${i}`, playerToken: null }, (res) => {
      if (res && res.ok) {
        joined += 1;
      } else {
        joinErrors += 1;
      }
    });
  });

  socket.on('game:question', (payload) => {
    lastQuestionAt = Date.now();
    const optionId = payload.options[0].id;
    socket.emit('player:answer', { code, playerToken: null, optionId }, () => {});
  });

  socket.on('game:reveal', () => {
    if (lastQuestionAt) {
      revealDelays.push(Date.now() - lastQuestionAt);
    }
  });
}

// Relatório periódico.
setInterval(() => {
  const max = revealDelays.length ? Math.max(...revealDelays) : 0;
  const avg = revealDelays.length
    ? Math.round(revealDelays.reduce((a, b) => a + b, 0) / revealDelays.length)
    : 0;
  console.log(
    `entraram=${joined} erros=${joinErrors} reveals=${revealDelays.length} atraso_medio=${avg}ms atraso_max=${max}ms`
  );
}, 3000);
