const router = require('express').Router();
const { query } = require('../db');
const { requireAuth, requireRank } = require('../auth');

router.get('/', requireAuth, async (req,res)=>{
  const { q } = req.query;
  const result = q
    ? await query(`SELECT o.*, m.display_name AS creator_name FROM orders o LEFT JOIN members m ON m.id=o.created_by WHERE o.member_name ILIKE $1 OR o.license_plate ILIKE $1 OR o.type ILIKE $1 ORDER BY o.created_at DESC`, [`%${q}%`])
    : await query(`SELECT o.*, m.display_name AS creator_name FROM orders o LEFT JOIN members m ON m.id=o.created_by ORDER BY o.created_at DESC`);
  res.json(result.rows);
});

router.post('/', requireAuth, async (req,res)=>{
  const { type, memberName, licensePlate, color, period, reason, fine, imageData } = req.body;
  if (!['Xenon','Stance','Urlaub','Sanktion','Hausverbot'].includes(type)) return res.status(400).json({error:'Ungültiger Auftragstyp'});
  if ((type==='Sanktion' || type==='Hausverbot') && req.user.rank < 10 && req.user.software_role !== 'Administrator') return res.status(403).json({error:'Keine Berechtigung'});
  if (!memberName) return res.status(400).json({error:'Name erforderlich'});
  const result = await query(`INSERT INTO orders (type, member_name, license_plate, color, period, reason, fine, image_data, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [type, memberName.trim(), licensePlate||null, color||null, period||null, reason||null, fine===''?null:fine||null, imageData||null, req.user.id]);
  res.status(201).json(result.rows[0]);
});

router.delete('/:id', requireAuth, async (req,res)=>{
  if (req.user.software_role !== 'Administrator' && req.user.rank < 10) return res.status(403).json({error:'Keine Berechtigung'});
  await query('DELETE FROM orders WHERE id=$1',[Number(req.params.id)]);
  res.json({ok:true});
});

module.exports=router;
