import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/invoices/:id — verifica que pertence ao usuário via JOIN
router.get('/:id', async (req, res) => {
  try {
    const invoiceRes = await query(
      `SELECT i.*, c.name AS card_name, c.brand AS card_brand,
        c.color AS card_color, c.closing_day, c.due_day, c.limit_amount
       FROM invoices i
       JOIN cards c ON i.card_id = c.id
       WHERE i.id = $1 AND c.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (invoiceRes.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });

    const expensesRes = await query(
      'SELECT * FROM expenses WHERE invoice_id = $1 ORDER BY purchase_date DESC',
      [req.params.id]
    );

    res.json({ ...invoiceRes.rows[0], expenses: expensesRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/invoices — criar fatura (verifica ownership do cartão)
router.post('/', async (req, res) => {
  try {
    const { card_id, month, year } = req.body;
    if (!card_id || !month || !year) {
      return res.status(400).json({ error: 'Campos obrigatórios: card_id, month, year' });
    }

    const cardRes = await query(
      'SELECT * FROM cards WHERE id = $1 AND user_id = $2',
      [card_id, req.userId]
    );
    if (cardRes.rows.length === 0) return res.status(404).json({ error: 'Cartão não encontrado' });
    const card = cardRes.rows[0];

    const closingDate = new Date(year, month - 1, card.closing_day);
    const dueDate = card.due_day >= card.closing_day
      ? new Date(year, month - 1, card.due_day)
      : new Date(year, month, card.due_day);

    const result = await query(
      `INSERT INTO invoices (card_id, month, year, closing_date, due_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (card_id, month, year) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [card_id, month, year, closingDate, dueDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/invoices/:id/close
router.post('/:id/close', async (req, res) => {
  try {
    const check = await query(
      `SELECT i.id FROM invoices i JOIN cards c ON i.card_id = c.id
       WHERE i.id = $1 AND c.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });

    const result = await query(
      `UPDATE invoices SET status = 'closed' WHERE id = $1 AND status = 'open' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Fatura já fechada' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/invoices/:id/pay
router.post('/:id/pay', async (req, res) => {
  try {
    const check = await query(
      `SELECT i.id FROM invoices i JOIN cards c ON i.card_id = c.id
       WHERE i.id = $1 AND c.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Fatura não encontrada' });

    const result = await query(
      `UPDATE invoices SET status = 'paid' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
