const router=require('express').Router();
const {query}=require('../db');
const {requireAuth}=require('../auth');
router.get('/',requireAuth,async(req,res)=>{const r=await query('SELECT a.*, m.display_name AS creator_name FROM announcements a LEFT JOIN members m ON m.id=a.created_by ORDER BY a.created_at DESC');res.json(r.rows)});
router.post('/',requireAuth,async(req,res)=>{const {title,content}=req.body;if(!title||!content)return res.status(400).json({error:'Titel und Inhalt erforderlich'});const r=await query('INSERT INTO announcements(title,content,created_by) VALUES($1,$2,$3) RETURNING *',[title,content,req.user.id]);res.status(201).json(r.rows[0])});
router.delete('/:id',requireAuth,async(req,res)=>{await query('DELETE FROM announcements WHERE id=$1',[Number(req.params.id)]);res.json({ok:true})});
module.exports=router;
