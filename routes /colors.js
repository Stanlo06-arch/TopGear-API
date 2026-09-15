const router = require('express').Router();
const { query } = require('../db');
const { authRequired, requireRank } = require('../auth');

router.get('/', authRequired, async (req, res) => {
  try {
    const { category, q } = req.query;

    let text = `
      SELECT
        c.*,
        m.display_name AS updated_by_name
      FROM colors c
      LEFT JOIN members m ON m.id = c.updated_by
    `;

    const params = [];
    const where = [];

    if (category) {
      params.push(category);
      where.push(`c.category = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(`
        (
          c.group_name ILIKE $${params.length}
          OR c.primary_color ILIKE $${params.length}
          OR c.secondary_color ILIKE $${params.length}
          OR c.pearlescent ILIKE $${params.length}
          OR c.underbody ILIKE $${params.length}
        )
      `);
    }

    if (where.length) {
      text += ` WHERE ${where.join(' AND ')}`;
    }

    text += ' ORDER BY c.category, c.group_name';

    const r = await query(text, params);

    res.json(r.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Farben konnten nicht geladen werden'
    });
  }
});

router.post('/', authRequired, requireRank(3), async (req, res) => {
  try {
    const {
      category,
      groupName,
      primaryColor,
      secondaryColor,
      pearlescent,
      underbody,
      effect,
      info
    } = req.body || {};

    if (
      !['Familie', 'Staatlich', 'Unternehmen'].includes(category) ||
      !groupName
    ) {
      return res.status(400).json({
        error: 'Kategorie und Name erforderlich'
      });
    }

    const r = await query(
      `INSERT INTO colors
        (
          category,
          group_name,
          primary_color,
          secondary_color,
          pearlescent,
          underbody,
          effect,
          info,
          updated_by
        )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        category,
        groupName,
        primaryColor || null,
        secondaryColor || null,
        pearlescent || null,
        underbody || null,
        effect || null,
        info || null,
        req.user.sub
      ]
    );

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Farbe konnte nicht erstellt werden'
    });
  }
});

router.patch('/:id', authRequired, requireRank(3), async (req, res) => {
  try {
    const {
      groupName,
      primaryColor,
      secondaryColor,
      pearlescent,
      underbody,
      effect,
      info,
      category
    } = req.body || {};

    const r = await query(
      `UPDATE colors
       SET
         category = COALESCE($1, category),
         group_name = COALESCE($2, group_name),
         primary_color = $3,
         secondary_color = $4,
         pearlescent = $5,
         underbody = $6,
         effect = $7,
         info = $8,
         updated_by = $9,
         updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        category || null,
        groupName || null,
        primaryColor || null,
        secondaryColor || null,
        pearlescent || null,
        underbody || null,
        effect || null,
        info || null,
        req.user.sub,
        Number(req.params.id)
      ]
    );

    if (!r.rowCount) {
      return res.status(404).json({
        error: 'Farbe nicht gefunden'
      });
    }

    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Farbe konnte nicht geändert werden'
    });
  }
});

router.delete('/:id', authRequired, requireRank(3), async (req, res) => {
  try {
    await query(
      'DELETE FROM colors WHERE id = $1',
      [Number(req.params.id)]
    );

    res.json({
      ok: true
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Farbe konnte nicht gelöscht werden'
    });
  }
});

module.exports = router;
