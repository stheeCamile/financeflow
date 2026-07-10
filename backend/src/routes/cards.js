import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware); // protege todas as rotas

// GET /api/cards
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*,
        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          JOIN invoices i ON e.invoice_id = i.id
          WHERE i.card_id = c.id
            AND i.month = EXTRACT(MONTH FROM NOW())
            AND i.year = EXTRACT(YEAR FROM NOW())
        ), 0) AS current_month_spent
      FROM cards c
      WHERE c.is_active = TRUE AND c.user_id = $1
      ORDER BY c.created_at ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cards/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM cards WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/cards
router.post('/', async (req, res) => {
  try {
    const { name, brand, color, limit_amount, closing_day, due_day, last_four_digits, is_active, type, balance } = req.body;
    const cardType = type === 'debit' ? 'debit' : type === 'account' ? 'account' : 'credit';

    if (!name || !brand) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, brand' });
    }
    if (cardType === 'credit' && (!closing_day || !due_day)) {
      return res.status(400).json({ error: 'Cartões de crédito exigem closing_day e due_day' });
    }

    const result = await query(
      `INSERT INTO cards (name, brand, color, limit_amount, closing_day, due_day, last_four_digits, user_id, type, balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, brand, color || '#7c3aed', limit_amount || 0, closing_day || null, due_day || null, last_four_digits, req.userId, cardType, balance || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/cards/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, brand, color, limit_amount, closing_day, due_day, last_four_digits, is_active, type, balance } = req.body;
    const cardType = type === 'debit' ? 'debit' : type === 'account' ? 'account' : 'credit';
    const result = await query(
      `UPDATE cards 
       SET name=$1, brand=$2, color=$3, limit_amount=$4, closing_day=$5, due_day=$6, last_four_digits=$7, is_active=$8, type=$9, balance=$10
       WHERE id=$11 AND user_id=$12 RETURNING *`,
      [name, brand, color, limit_amount, closing_day, due_day, last_four_digits, is_active, cardType, balance || 0, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/cards/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'UPDATE cards SET is_active = FALSE WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    res.json({ message: 'Cartão removido' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/cards/:id/invoices
router.get('/:id/invoices', async (req, res) => {
  try {
    // Confirma que o cartão pertence ao usuário
    const cardCheck = await query(
      'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (cardCheck.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });

    const result = await query(
      `SELECT i.*, COUNT(e.id) AS expense_count
       FROM invoices i
       LEFT JOIN expenses e ON e.invoice_id = i.id
       WHERE i.card_id = $1
       GROUP BY i.id
       ORDER BY i.year DESC, i.month DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
