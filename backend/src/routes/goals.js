import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT g.*,
        ROUND((g.current_amount / NULLIF(g.target_amount, 0)) * 100, 1) AS progress_percent
       FROM goals g
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const goalRes = await query(
      `SELECT *, ROUND((current_amount / NULLIF(target_amount, 0)) * 100, 1) AS progress_percent
       FROM goals WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (goalRes.rows.length === 0) return res.status(404).json({ error: 'Meta não encontrada' });

    const contribRes = await query(
      'SELECT * FROM goal_contributions WHERE goal_id = $1 ORDER BY contributed_at DESC',
      [req.params.id]
    );
    res.json({ ...goalRes.rows[0], contributions: contribRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, target_amount, deadline, color, emoji } = req.body;
    if (!name || !target_amount) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, target_amount' });
    }
    const result = await query(
      `INSERT INTO goals (name, description, target_amount, deadline, color, emoji, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description, target_amount, deadline || null, color || '#7c3aed', emoji || '🎯', req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/contribute', async (req, res) => {
  try {
    const goalCheck = await query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (goalCheck.rows.length === 0) return res.status(404).json({ error: 'Meta não encontrada' });

    const { amount, note } = req.body;
    if (!amount) return res.status(400).json({ error: 'Informe o valor do aporte' });

    const result = await query(
      'INSERT INTO goal_contributions (goal_id, amount, note) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, amount, note]
    );
    const goalRes = await query(
      'SELECT *, ROUND((current_amount / NULLIF(target_amount, 0)) * 100, 1) AS progress_percent FROM goals WHERE id = $1',
      [req.params.id]
    );
    res.status(201).json({ contribution: result.rows[0], goal: goalRes.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, description, target_amount, deadline, color, emoji } = req.body;
    const result = await query(
      `UPDATE goals SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        target_amount = COALESCE($3, target_amount), deadline = COALESCE($4, deadline),
        color = COALESCE($5, color), emoji = COALESCE($6, emoji)
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [name, description, target_amount, deadline, color, emoji, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Meta não encontrada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Meta não encontrada' });
    res.json({ message: 'Meta removida' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
