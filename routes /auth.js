console.log('AUTH ROUTE GELADEN');

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken, authRequired } = require('../auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, display_name, password } = req.body || {};

    if (!username || !display_name || !password) {
      return res.status(400).json({
        error: 'Benutzername, Anzeigename und Passwort sind erforderlich'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Passwort muss mindestens 6 Zeichen haben'
      });
    }

    const existing = await query(
      'SELECT id FROM members WHERE lower(username) = lower($1)',
      [username.trim()]
    );

    if (existing.rowCount) {
      return res.status(409).json({
        error: 'Benutzername bereits vergeben'
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO members
        (username, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, display_name, rank, software_role, online, created_at`,
      [
        username.trim(),
        display_name.trim(),
        hash
      ]
    );

    const user = result.rows[0];

    res.status(201).json({
      user,
      token: signToken(user)
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Registrierung fehlgeschlagen'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: 'Benutzername und Passwort erforderlich'
      });
    }

    const result = await query(
      'SELECT * FROM members WHERE lower(username) = lower($1)',
      [username.trim()]
    );

    if (!result.rowCount) {
      return res.status(401).json({
        error: 'Ungültige Zugangsdaten'
      });
    }

    const row = result.rows[0];

    const ok = await bcrypt.compare(
      password,
      row.password_hash
    );

    if (!ok) {
      return res.status(401).json({
        error: 'Ungültige Zugangsdaten'
      });
    }

    await query(
      'UPDATE members SET online = true, updated_at = NOW() WHERE id = $1',
      [row.id]
    );

    const user = {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      rank: row.rank,
      software_role: row.software_role,
      online: true
    };

    res.json({
      user,
      token: signToken(user)
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Login fehlgeschlagen'
    });
  }
});

router.post('/logout', authRequired, async (req, res) => {
  try {
    await query(
      'UPDATE members SET online = false, updated_at = NOW() WHERE id = $1',
      [req.user.sub]
    );

    res.json({
      ok: true
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Logout fehlgeschlagen'
    });
  }
});

module.exports = router;
