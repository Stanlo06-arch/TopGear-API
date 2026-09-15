const router = require('express').Router();
const { query } = require('../db');
const { authRequired } = require('../auth');

router.get('/', authRequired, async (req, res) => {
  try {
    const r = await query(`
      SELECT
        a.*,
        m.display_name AS creator_name
      FROM announcements a
      LEFT JOIN members m ON m.id = a.created_by
      ORDER BY a.created_at DESC
    `);

    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Ankündigungen konnten nicht geladen werden'
    });
  }
});

router.post('/', authRequired, async (req, res) => {
  try {
    const { title, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        error: 'Titel und Inhalt erforderlich'
      });
    }

    const r = await query(
      `INSERT INTO announcements
        (title, content, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, content, req.user.sub]
    );

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Ankündigung konnte nicht erstellt werden'
    });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    await query(
      'DELETE FROM announcements WHERE id = $1',
      [Number(req.params.id)]
    );

    res.json({
      ok: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Ankündigung konnte nicht gelöscht werden'
    });
  }
});

module.exports = router;
