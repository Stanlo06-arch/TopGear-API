const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signUser, requireAuth } = require('../auth');

router.post('/register', async (req, res) => {
  try {
    const { username, displayName, password } = req.body;
    if (!username || !displayName || !password || password.length < 6) {
      return res.status(400).json({ error: 'Benutzername, Name und Passwort (mind. 6 Zeichen) erforderlich' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await query(`
      INSERT INTO members (username, display_name, password_hash, rank, software_role)
      VALUES ($1, $2, $3, 2, 'Mitglied')
      RETURNING id, username, display_name, rank, software_role, online, created_at
    `, [username.trim(), displayName.trim(), hash]);
    const user = result.rows[0];
    res.status(201).json({ user, token: signUser(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Benutzername ist bereits vergeben' });
    console.error(err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await query('SELECT * FROM members WHERE username = $1', [username?.trim()]);
    if (!result.rowCount) return res.status(401).json({ error: 'Login-Daten falsch' });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password || '', user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Login-Daten falsch' });
    await query('UPDATE members SET online = true, updated_at = NOW() WHERE id = $1', [user.id]);
    const safe = { id:user.id, username:user.username, display_name:user.display_name, rank:user.rank, software_role:user.software_role, online:true, created_at:user.created_at };
    res.json({ user: safe, token: signUser(safe) });
  } catch (err) {
    console.error(err); res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  await query('UPDATE members SET online = false, updated_at = NOW() WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
