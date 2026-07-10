import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { month, year } = req.query;
    let sql = 'SELECT * FROM revenues WHERE user_id = $1';
    const params = [req.userId];
    let idx = 2;

    if (month) { sql += ` AND EXTRACT(MONTH FROM received_date) = $${idx++}`; params.push(month); }
    if (year)  { sql += ` AND EXTRACT(YEAR FROM received_date) = $${idx++}`;  params.push(year); }

    sql += ' ORDER BY received_date DESC';
    res.json((await query(sql, params)).rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { description, category, amount, received_date, is_recurring, recurrence, notes, account_id } = req.body;
    if (!description || !amount) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, amount' });
    }
    const result = await query(
      `INSERT INTO revenues (description, category, amount, received_date, is_recurring, recurrence, notes, user_id, account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [description, category || 'outros', amount,
       received_date || new Date().toISOString().split('T')[0],
       is_recurring || false, recurrence || null, notes, req.userId, account_id || null]
    );

    if (account_id) {
      await query(`UPDATE cards SET balance = balance + $1 WHERE id = $2 AND user_id = $3`, [amount, account_id, req.userId]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { description, category, amount, received_date, is_recurring, recurrence, notes, account_id } = req.body;
    const result = await query(
      `UPDATE revenues SET
        description = COALESCE($1, description), category = COALESCE($2, category),
        amount = COALESCE($3, amount), received_date = COALESCE($4, received_date),
        is_recurring = COALESCE($5, is_recurring), recurrence = COALESCE($6, recurrence),
        notes = COALESCE($7, notes), account_id = $8
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [description, category, amount, received_date, is_recurring, recurrence, notes, account_id || null, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Receita não encontrada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM revenues WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Receita não encontrada' });
    res.json({ message: 'Receita removida' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
