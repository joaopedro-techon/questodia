'use strict';

const config = require('../config');

// Pontos de uma resposta. Errado/sem resposta = 0. Ao acertar, garante um piso
// (metade da base) e soma a parcela proporcional à rapidez.
function computePoints(correct, responseTimeMs, timeLimitSec) {
  if (!correct) {
    return 0;
  }
  const limitMs = timeLimitSec * 1000;
  const remainingMs = Math.max(0, limitMs - responseTimeMs);
  const speedFraction = limitMs > 0 ? remainingMs / limitMs : 0;
  const fraction = config.minCorrectFraction + (1 - config.minCorrectFraction) * speedFraction;
  return Math.round(config.basePoints * fraction);
}

// Ordena jogadores por pontuação desc.; desempate por menor tempo total de resposta.
// Recebe uma lista de { nickname, score, totalResponseTimeMs } e devolve com `rank`.
function buildRanking(players) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.totalResponseTimeMs - b.totalResponseTimeMs;
  });
  return sorted.map((player, index) => ({
    nickname: player.nickname,
    score: player.score,
    rank: index + 1,
  }));
}

// Os 3 primeiros do ranking (ou menos, se houver menos jogadores).
function buildPodium(ranking) {
  return ranking.slice(0, 3);
}

module.exports = { computePoints, buildRanking, buildPodium };
