const router=require('express').Router();
const {query}=require('../db');
const {requireAuth}=require('../auth');
router.get('/',requireAuth,async(req,res)=>{const r=await query('SELECT a.*, m.display_name AS creator_name FROM appointments a LEFT JOIN members m ON m.id=a.created_by ORDER BY a.date_value,a.time_value NULLS LAST');res.json(r.rows)});
router.post('/',requireAuth,async(req,res)=>{const {title,date,time,location,description}=req.body;if(!title||!date)return res.status(400).json({error:'Titel und Datum erforderlich'});const r=await query('INSERT INTO appointments(title,date_value,time_value,location,description,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[title,date,time||null,location||null,description||null,req.user.id]);res.status(201).json(r.rows[0])});
router.delete('/:id',requireAuth,async(req,res)=>{await query('DELETE FROM appointments WHERE id=$1',[Number(req.params.id)]);res.json({ok:true})});
module.exports=router;
