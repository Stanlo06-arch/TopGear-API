const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const {
  authRequired,
  requireRank
} = require('../auth');

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        username,
        display_name,
        rank,
        software_role,
        online,
        created_at,
        updated_at
      FROM members
      ORDER BY rank DESC, display_name
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Mitarbeiter konnten nicht geladen werden'
    });
  }
});

router.post('/', authRequired, requireRank(10), async (req, res) => {
  try {
    const {
      username,
      displayName,
      password,
      rank = 2,
      softwareRole = 'Mitglied'
    } = req.body || {};

    if (!username || !displayName || !password) {
      return res.status(400).json({
        error: 'Pflichtfelder fehlen'
      });
    }

    const newRank = Number(rank);

    if (newRank < 1 || newRank > 12) {
      return res.status(400).json({
        error: 'Rang muss 1–12 sein'
      });
    }

    if (
      !['Mitglied', 'Administrator'].includes(softwareRole)
    ) {
      return res.status(400).json({
        error: 'Ungültige Software-Rolle'
      });
    }

    if (
      req.user.software_role !== 'Administrator' &&
      newRank > Number(req.user.rank)
    ) {
      return res.status(403).json({
        error: 'Du kannst keinen höheren Rang vergeben'
      });
    }

    if (
      softwareRole === 'Administrator' &&
      req.user.software_role !== 'Administrator'
    ) {
      return res.status(403).json({
        error: 'Administrator-Rechte können nur von einem Administrator vergeben werden'
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO members
        (
          username,
          display_name,
          password_hash,
          rank,
          software_role
        )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         username,
         display_name,
         rank,
         software_role,
         online,
         created_at`,
      [
        username.trim(),
        displayName.trim(),
        hash,
        newRank,
        softwareRole
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Benutzername bereits vergeben'
      });
    }

    res.status(500).json({
      error: 'Mitglied konnte nicht angelegt werden'
    });
  }
});

router.patch('/:id', authRequired, async (req, res) => {
  try {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId)) {
      return res.status(400).json({
        error: 'Ungültige ID'
      });
    }

    const target = await query(
      `SELECT
        id,
        rank,
        software_role
       FROM members
       WHERE id = $1`,
      [targetId]
    );

    if (!target.rowCount) {
      return res.status(404).json({
        error: 'Mitglied nicht gefunden'
      });
    }

    const currentUserId = Number(req.user.sub);
    const currentUserRank = Number(req.user.rank);

    const isSelf = targetId === currentUserId;

    const canManage =
      req.user.software_role === 'Administrator' ||
      currentUserRank >= 10;

    if (!canManage) {
      return res.status(403).json({
        error: 'Keine Berechtigung'
      });
    }

    if (
      !isSelf &&
      Number(target.rows[0].rank) > currentUserRank &&
      req.user.software_role !== 'Administrator'
    ) {
      return res.status(403).json({
        error: 'Höheren Rang darfst du nicht bearbeiten'
      });
    }

    const {
      displayName,
      password,
      rank,
      softwareRole,
      online
    } = req.body || {};

    const nextRank =
      rank == null
        ? Number(target.rows[0].rank)
        : Number(rank);

    const nextRole =
      softwareRole ||
      target.rows[0].software_role;

    if (nextRank < 1 || nextRank > 12) {
      return res.status(400).json({
        error: 'Rang muss 1–12 sein'
      });
    }

    if (
      !['Mitglied', 'Administrator'].includes(nextRole)
    ) {
      return res.status(400).json({
        error: 'Ungültige Software-Rolle'
      });
    }

    if (
      req.user.software_role !== 'Administrator' &&
      nextRank > currentUserRank
    ) {
      return res.status(403).json({
        error: 'Du kannst keinen höheren Rang vergeben'
      });
    }

    if (
      nextRole === 'Administrator' &&
      req.user.software_role !== 'Administrator'
    ) {
      return res.status(403).json({
        error: 'Administrator-Rechte können nur von einem Administrator vergeben werden'
      });
    }

    const hash = password
      ? await bcrypt.hash(password, 12)
      : null;

    const result = await query(
      `UPDATE members
       SET
         display_name = COALESCE($1, display_name),
         password_hash = COALESCE($2, password_hash),
         rank = $3,
         software_role = $4,
         online = COALESCE($5, online),
         updated_at = NOW()
       WHERE id = $6
       RETURNING
         id,
         username,
         display_name,
         rank,
         software_role,
         online,
         created_at,
         updated_at`,
      [
        displayName?.trim() || null,
        hash,
        nextRank,
        nextRole,
        typeof online === 'boolean'
          ? online
          : null,
        targetId
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Mitglied konnte nicht geändert werden'
    });
  }
});

router.delete('/:id', authRequired, requireRank(10), async (req, res) => {
  try {
    const targetId = Number(req.params.id);

    if (targetId === Number(req.user.sub)) {
      return res.status(400).json({
        error: 'Du kannst dich nicht selbst löschen'
      });
    }

    const target = await query(
      'SELECT rank FROM members WHERE id = $1',
      [targetId]
    );

    if (!target.rowCount) {
      return res.status(404).json({
        error: 'Mitglied nicht gefunden'
      });
    }

    if (
      req.user.software_role !== 'Administrator' &&
      Number(target.rows[0].rank) >= Number(req.user.rank)
    ) {
      return res.status(403).json({
        error: 'Gleichwertige oder höhere Ränge dürfen nicht gelöscht werden'
      });
    }

    await query(
      'DELETE FROM members WHERE id = $1',
      [targetId]
    );

    res.json({
      ok: true
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Mitglied konnte nicht gelöscht werden'
    });
  }
});

router.get('/me/stats', authRequired, async (req, res) => {
  try {
    const total = await query(
      'SELECT COUNT(*)::int AS count FROM members'
    );

    const online = await query(
      'SELECT COUNT(*)::int AS count FROM members WHERE online = true'
    );

    res.json({
      total: total.rows[0].count,
      online: online.rows[0].count
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Statistiken konnten nicht geladen werden'
    });
  }
});

module.exports = router;
