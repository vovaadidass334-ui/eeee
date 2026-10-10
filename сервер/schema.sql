-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nick TEXT NOT NULL UNIQUE,
  rank_key TEXT DEFAULT 'unassigned',
  balance INTEGER DEFAULT 0,
  forum TEXT DEFAULT '',
  vk TEXT DEFAULT '',
  pass TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Отчёты
CREATE TABLE IF NOT EXISTS reports (
  id BIGINT PRIMARY KEY,
  user_id TEXT,
  nick TEXT,
  rank_key TEXT,
  date TEXT,
  shift_date TEXT,
  h_day REAL DEFAULT 0,
  h_night REAL DEFAULT 0,
  h_over REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  proof TEXT,
  bonuses TEXT DEFAULT '[]',
  base INTEGER DEFAULT 0,
  final INTEGER DEFAULT 0,
  penalties TEXT DEFAULT 'Без взысканий',
  comment TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Чёрный список
CREATE TABLE IF NOT EXISTS blacklist (
  id BIGINT PRIMARY KEY,
  nick TEXT NOT NULL,
  reason TEXT,
  date TEXT
);

-- Аудит
CREATE TABLE IF NOT EXISTS audit (
  id BIGSERIAL PRIMARY KEY,
  action TEXT,
  details TEXT,
  time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Задачи
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY,
  title TEXT,
  prio TEXT DEFAULT 'normal',
  date TEXT,
  done BOOLEAN DEFAULT FALSE,
  created TEXT
);

-- Апелляции
CREATE TABLE IF NOT EXISTS appeals (
  id BIGINT PRIMARY KEY,
  report_id BIGINT,
  nick TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  date TEXT
);

-- Уведомления
CREATE TABLE IF NOT EXISTS notifs (
  id BIGSERIAL PRIMARY KEY,
  ic TEXT,
  tx TEXT,
  cls TEXT DEFAULT '',
  time TEXT
);

-- Пароли (одна строка, id=1)
CREATE TABLE IF NOT EXISTS pins (
  id INTEGER PRIMARY KEY,
  pin_lead TEXT,
  pin_founder TEXT
);

INSERT INTO pins (id, pin_lead, pin_founder)
VALUES (1, 'CHANGE_ME_LEAD', 'CHANGE_ME_FOUNDER')
ON CONFLICT (id) DO NOTHING;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);