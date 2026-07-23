-- Schema do Questódia (SQLite). Apenas os quizzes são persistidos.

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  management_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_management_code ON quizzes (management_code);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  time_limit_sec INTEGER NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);

CREATE TABLE IF NOT EXISTS answer_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_answer_options_question_id ON answer_options (question_id);
