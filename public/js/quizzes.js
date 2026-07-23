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

  function showAlert(message, type) {
    $('alert').innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
  }

  async function loadQuizzes() {
    const res = await fetch('/api/quizzes');
    if (!res.ok) {
      showAlert('Não foi possível carregar os quizzes.', 'error');
      return;
    }
    const quizzes = await res.json();
    render(quizzes);
  }

  async function deleteQuiz(managementCode, title) {
    const confirmed = window.confirm(
      `Excluir o quiz "${title}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) {
      return;
    }
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(managementCode)}`, {
        method: 'DELETE',
      });
      if (res.status === 404) {
        showAlert('Este quiz já não existe mais.', 'error');
        await loadQuizzes();
        return;
      }
      if (!res.ok) {
        showAlert('Não foi possível excluir o quiz. Tente novamente.', 'error');
        return;
      }
      showAlert(`Quiz "${title}" excluído com sucesso.`, 'ok');
      await loadQuizzes();
    } catch (err) {
      showAlert('Erro de conexão ao excluir o quiz. Tente novamente.', 'error');
    }
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
        <button class="danger small" data-delete="${quiz.managementCode}">Excluir</button>
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
    list.querySelectorAll('[data-delete]').forEach((btn) => {
      const quiz = quizzes.find((q) => q.managementCode === btn.dataset.delete);
      btn.addEventListener('click', () => {
        deleteQuiz(btn.dataset.delete, quiz ? quiz.title : '');
      });
    });
  }

  loadQuizzes();
})();
