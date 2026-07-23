'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    return date.toLocaleString('pt-BR');
  }

  async function loadQuizzes() {
    const res = await fetch('/api/quizzes');
    if (!res.ok) {
      $('alert').innerHTML =
        '<div class="notice error">Não foi possível carregar os quizzes.</div>';
      return;
    }
    const quizzes = await res.json();
    render(quizzes);
  }

  function render(quizzes) {
    const list = $('list');
    if (quizzes.length === 0) {
      list.innerHTML =
        '<p class="muted">Nenhum quiz salvo ainda. Clique em "Novo quiz" para começar.</p>';
      return;
    }
    list.innerHTML = '';
    quizzes.forEach((quiz) => {
      const item = document.createElement('div');
      item.className = 'quiz-item';
      item.innerHTML = `
        <div class="quiz-meta">
          <div class="quiz-title">${escapeHtml(quiz.title)}</div>
          <div class="quiz-sub">
            ${quiz.questionCount} pergunta(s) · atualizado em ${formatDate(quiz.updatedAt)}<br />
            código de gestão: <span class="quiz-code">${escapeHtml(quiz.managementCode)}</span>
          </div>
        </div>
        <button class="ghost small" data-edit="${quiz.managementCode}">Editar</button>
        <button class="small" data-launch="${quiz.managementCode}">Lançar</button>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = `/host.html?code=${encodeURIComponent(btn.dataset.edit)}`;
      });
    });
    list.querySelectorAll('[data-launch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = `/host.html?code=${encodeURIComponent(btn.dataset.launch)}&launch=1`;
      });
    });
  }

  loadQuizzes();
})();
