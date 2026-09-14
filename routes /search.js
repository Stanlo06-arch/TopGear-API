const router=require('express').Router();
const {query}=require('../db');
const {requireAuth}=require('../auth');
router.get('/',requireAuth,async(req,res)=>{const q=(req.query.q||'').trim();if(!q)return res.json({members:[],orders:[],appointments:[],announcements:[],colors:[]});const like=`%${q}%`;const [members,orders,appointments,announcements,colors]=await Promise.all([
  query('SELECT id,username,display_name,rank,software_role,online FROM members WHERE username ILIKE $1 OR display_name ILIKE $1 ORDER BY display_name',[like]),
  query('SELECT * FROM orders WHERE member_name ILIKE $1 OR license_plate ILIKE $1 OR type ILIKE $1 OR reason ILIKE $1 ORDER BY created_at DESC',[like]),
  query('SELECT * FROM appointments WHERE title ILIKE $1 OR location ILIKE $1 OR description ILIKE $1 ORDER BY date_value',[like]),
  query('SELECT * FROM announcements WHERE title ILIKE $1 OR content ILIKE $1 ORDER BY created_at DESC',[like]),
  query('SELECT * FROM colors WHERE group_name ILIKE $1 OR primary_color ILIKE $1 OR secondary_color ILIKE $1 OR pearlescent ILIKE $1 OR underbody ILIKE $1 ORDER BY group_name',[like])
]);res.json({members:members.rows,orders:orders.rows,appointments:appointments.rows,announcements:announcements.rows,colors:colors.rows})});
module.exports=router;
