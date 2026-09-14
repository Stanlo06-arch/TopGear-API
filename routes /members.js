const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireAdmin, requireRank } = require('../auth');

router.get('/', requireAuth, async (req, res) => {
  const result = await query('SELECT id, username, display_name, rank, software_role, online, created_at, updated_at FROM members ORDER BY rank DESC, display_name');
  res.json(result.rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { username, displayName, password, rank = 2, softwareRole = 'Mitglied' } = req.body;
  if (!username || !displayName || !password) return res.status(400).json({ error:'Pflichtfelder fehlen' });
  if (rank < 1 || rank > 12) return res.status(400).json({ error:'Rang muss 1–12 sein' });
  if (!['Mitglied','Administrator'].includes(softwareRole)) return res.status(400).json({ error:'Ungültige Software-Rolle' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await query(`INSERT INTO members (username, display_name, password_hash, rank, software_role) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, display_name, rank, software_role, online, created_at`, [username.trim(), displayName.trim(), hash, rank, softwareRole]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error:'Benutzername bereits vergeben' });
    res.status(500).json({ error:'Mitglied konnte nicht angelegt werden' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error:'Ungültige ID' });
  const target = await query('SELECT id, rank, software_role FROM members WHERE id=$1', [targetId]);
  if (!target.rowCount) return res.status(404).json({ error:'Mitglied nicht gefunden' });
  const isSelf = targetId === req.user.id;
  const canManage = req.user.software_role === 'Administrator' || req.user.rank >= 10;
  if (!canManage) return res.status(403).json({ error:'Keine Berechtigung' });
  if (!isSelf && target.rows[0].rank > req.user.rank && req.user.software_role !== 'Administrator') return res.status(403).json({ error:'Höheren Rang darfst du nicht bearbeiten' });

  const { displayName, password, rank, softwareRole, online } = req.body;
  const nextRank = rank == null ? target.rows[0].rank : Number(rank);
  const nextRole = softwareRole || target.rows[0].software_role;
  if (nextRank < 1 || nextRank > 12) return res.status(400).json({ error:'Rang muss 1–12 sein' });
  if (!['Mitglied','Administrator'].includes(nextRole)) return res.status(400).json({ error:'Ungültige Software-Rolle' });
  if (req.user.software_role !== 'Administrator' && (nextRank > req.user.rank || nextRole === 'Administrator' && req.user.rank < 12)) {
    return res.status(403).json({ error:'Diese Änderung ist für deinen Rang nicht erlaubt' });
  }
  const hash = password ? await bcrypt.hash(password, 12) : null;
  const result = await query(`
    UPDATE members
    SET display_name = COALESCE($1, display_name),
        password_hash = COALESCE($2, password_hash),
        rank = $3,
        software_role = $4,
        online = COALESCE($5, online),
        updated_at = NOW()
    WHERE id = $6
    RETURNING id, username, display_name, rank, software_role, online, created_at, updated_at
  `, [displayName?.trim() || null, hash, nextRank, nextRole, typeof online === 'boolean' ? online : null, targetId]);
  res.json(result.rows[0]);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error:'Du kannst dich nicht selbst löschen' });
  if (req.user.software_role !== 'Administrator' && req.user.rank < 10) return res.status(403).json({ error:'Keine Berechtigung' });
  const target = await query('SELECT rank FROM members WHERE id=$1', [targetId]);
  if (!target.rowCount) return res.status(404).json({ error:'Mitglied nicht gefunden' });
  if (req.user.software_role !== 'Administrator' && target.rows[0].rank >= req.user.rank) return res.status(403).json({ error:'Gleichwertige oder höhere Ränge dürfen nicht gelöscht werden' });
  await query('DELETE FROM members WHERE id=$1', [targetId]);
  res.json({ ok:true });
});

router.get('/me/stats', requireAuth, async (req, res) => {
  const total = await query('SELECT COUNT(*)::int AS count FROM members');
  const online = await query('SELECT COUNT(*)::int AS count FROM members WHERE online=true');
  res.json({ total: total.rows[0].count, online: online.rows[0].count });
});

module.exports = router;
