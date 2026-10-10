import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { q } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const ok = (res, data) => res.json({ ok: true, data });
const err = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

/* ---------- USERS ---------- */
app.get('/api/users', async (req, res) => {
  try {
    const rows = await q('SELECT id, nick, rank_key AS "rankKey", balance, forum, vk FROM users ORDER BY created_at');
    ok(res, rows);
  } catch (e) { err(res, e.message, 500); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const rows = await q('SELECT id, nick, rank_key AS "rankKey", balance, forum, vk FROM users WHERE id = $1', [req.params.id]);
    if (!rows.length) return err(res, 'Пользователь не найден', 404);
    ok(res, rows[0]);
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { id, nick, forum, vk, pass } = req.body;
    if (!nick || !pass) return err(res, 'Ник и пароль обязательны');
    const dup = await q('SELECT id FROM users WHERE LOWER(nick) = LOWER($1)', [nick]);
    if (dup.length) return err(res, 'Ник занят');
    const uid = id || ('user_' + Date.now());
    await q(
      'INSERT INTO users (id, nick, forum, vk, pass, rank_key, balance) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [uid, nick, forum || '', vk || '', pass, 'unassigned', 0]
    );
    ok(res, { id: uid, nick, rankKey: 'unassigned', balance: 0, forum, vk });
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/users/:id/rank', async (req, res) => {
  try {
    const { rankKey } = req.body;
    if (!rankKey) return err(res, 'rankKey обязателен');
    await q('UPDATE users SET rank_key = $1 WHERE id = $2', [rankKey, req.params.id]);
    ok(res, { updated: true });
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/users/:id/balance', async (req, res) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== 'number') return err(res, 'delta — число');
    await q('UPDATE users SET balance = GREATEST(0, balance + $1) WHERE id = $2', [delta, req.params.id]);
    ok(res, { updated: true });
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/users/reset-balances', async (req, res) => {
  try {
    await q('UPDATE users SET balance = 0');
    ok(res, { reset: true });
  } catch (e) { err(res, e.message, 500); }
});

/* ---------- REPORTS ---------- */
app.get('/api/reports', async (req, res) => {
  try {
    const rows = await q(`SELECT id, user_id AS "userId", nick, rank_key AS "rankKey",
      date, shift_date AS "shiftDate", h_day AS "hDay", h_night AS "hNight",
      h_over AS "hOver", reps, proof, bonuses, base, final, penalties, comment, status
      FROM reports ORDER BY id DESC`);
    ok(res, rows.map(r => ({ ...r, bonuses: JSON.parse(r.bonuses || '[]') })));
  } catch (e) { err(res, e.message, 500); }
});

app.post('/api/reports', async (req, res) => {
  try {
    const r = req.body;
    await q(`INSERT INTO reports
      (id, user_id, nick, rank_key, date, shift_date, h_day, h_night, h_over, reps,
       proof, bonuses, base, final, penalties, comment, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [r.id, r.userId, r.nick, r.rankKey, r.date, r.shiftDate, r.hDay, r.hNight, r.hOver,
       r.reps || 0, r.proof, JSON.stringify(r.bonuses || []), r.base, r.final,
       r.penalties || 'Без взысканий', r.comment || '', r.status || 'pending']);
    ok(res, { inserted: true });
  } catch (e) { err(res, e.message, 500); }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const allowed = ['final', 'penalties', 'status'];
    const patch = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of allowed) {
      if (k in patch) {
        const col = k === 'final' ? 'final' : k;
        sets.push(`${col} = $${i++}`);
        vals.push(patch[k]);
      }
    }
    if (!sets.length) return err(res, 'Нет полей для обновления');
    vals.push(req.params.id);
    await q(`UPDATE reports SET ${sets.join(', ')} WHERE id = $${i}`, vals);
    ok(res, { updated: true });
  } catch (e) { err(res, e.message, 500); }
});

/* ---------- BLACKLIST ---------- */
app.get('/api/blacklist', async (req, res) => {
  try { ok(res, await q('SELECT id, nick, reason, date FROM blacklist ORDER BY id DESC')); }
  catch (e) { err(res, e.message, 500); }
});
app.post('/api/blacklist', async (req, res) => {
  try {
    const { id, nick, reason, date } = req.body;
    await q('INSERT INTO blacklist (id, nick, reason, date) VALUES ($1,$2,$3,$4)', [id, nick, reason, date]);
    ok(res, { inserted: true });
  } catch (e) { err(res, e.message, 500); }
});
app.delete('/api/blacklist/:id', async (req, res) => {
  try { await q('DELETE FROM blacklist WHERE id = $1', [req.params.id]); ok(res, { deleted: true }); }
  catch (e) { err(res, e.message, 500); }
});

/* ---------- AUDIT ---------- */
app.get('/api/audit', async (req, res) => {
  try { ok(res, await q('SELECT id, action, details, time FROM audit ORDER BY id DESC LIMIT 80')); }
  catch (e) { err(res, e.message, 500); }
});
app.post('/api/audit', async (req, res) => {
  try {
    const { action, details, time } = req.body;
    await q('INSERT INTO audit (action, details, time) VALUES ($1,$2,$3)', [action, details, time]);
    ok(res, { inserted: true });
  } catch (e) { err(res, e.message, 500); }
});
app.delete('/api/audit', async (req, res) => {
  try { await q('DELETE FROM audit'); ok(res, { cleared: true }); }
  catch (e) { err(res, e.message, 500); }
});

/* ---------- TASKS ---------- */
app.get('/api/tasks', async (req, res) => {
  try { ok(res, await q('SELECT id, title, prio, date, done, created FROM tasks ORDER BY id DESC')); }
  catch (e) { err(res, e.message, 500); }
});
app.post('/api/tasks', async (req, res) => {
  try {
    const { id, title, prio, date, created } = req.body;
    await q('INSERT INTO tasks (id, title, prio, date, done, created) VALUES ($1,$2,$3,$4,FALSE,$5)',
      [id, title, prio, date, created]);
    ok(res, { inserted: true });
  } catch (e) { err(res, e.message, 500); }
});
app.patch('/api/tasks/:id', async (req, res) => {
  try { await q('UPDATE tasks SET done = $1 WHERE id = $2', [req.body.done, req.params.id]); ok(res, { updated: true }); }
  catch (e) { err(res, e.message, 500); }
});
app.delete('/api/tasks/:id', async (req, res) => {
  try { await q('DELETE FROM tasks WHERE id = $1', [req.params.id]); ok(res, { deleted: true }); }
  catch (e) { err(res, e.message, 500); }
});

/* ---------- APPEALS ---------- */
app.get('/api/appeals', async (req, res) => {
  try { ok(res, await q('SELECT id, report_id AS "reportId", nick, reason, status, date FROM appeals ORDER BY id DESC')); }
  catch (e) { err(res, e.message, 500); }
});
app.post('/api/appeals', async (req, res) => {
  try {
    const { id, reportId, nick, reason, date } = req.body;
    await q('INSERT INTO appeals (id, report_id, nick, reason, status, date) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, reportId, nick, reason, 'pending', date]);
    ok(res, { inserted: true });
  } catch (e) { err(res, e.message, 500); }
});
app.patch('/api/appeals/:id', async (req, res) => {
  try { await q('UPDATE appeals SET status = $1 WHERE id = $2', [req.body.status, req.params.id]); ok(res, { updated: true }); }
  catch (e) { err(res, e.message, 500); }
});

/* ---------- NOTIFS ---------- */
app.get('/api/notifs', async (req, res) => {
  try { ok(res, await q('SELECT id, ic, tx, cls, time FROM notifs ORDER BY id DESC LIMIT 30')); }
  catch (e) { err(res, e.message, 500); }
});
app.post('/api/notifs', async (req, res) => {
  try {
    const { ic, tx, cls, time } = req.body;
    await q('INSERT INTO notifs (ic, tx, cls, time) VALUES ($1,$2,$3,$4)', [ic, tx, cls || '', time]);
    ok(res, { inserted: true });
  } catch (e) { err(res, e.message, 500); }
});

/* ---------- PINS ---------- */
app.get('/api/pins', async (req, res) => {
  try {
    const rows = await q('SELECT pin_lead AS "pinLead", pin_founder AS "pinFounder" FROM pins WHERE id = 1');
    ok(res, rows[0] || {});
  } catch (e) { err(res, e.message, 500); }
});
app.post('/api/pins', async (req, res) => {
  try {
    const { pinLead, pinFounder } = req.body;
    const sets = [];
    const vals = [];
    let i = 1;
    if (pinLead) { sets.push(`pin_lead = $${i++}`); vals.push(pinLead); }
    if (pinFounder) { sets.push(`pin_founder = $${i++}`); vals.push(pinFounder); }
    if (!sets.length) return err(res, 'Нет полей');
    await q(`UPDATE pins SET ${sets.join(', ')} WHERE id = 1`, vals);
    ok(res, { updated: true });
  } catch (e) { err(res, e.message, 500); }
});

/* ---------- HEALTH ---------- */
app.get('/', (req, res) => res.send('GROZOV IMPERIUM API работает'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API слушает порт ' + PORT));