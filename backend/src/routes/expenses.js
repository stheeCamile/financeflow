import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// Helper: garante que o cartão pertence ao usuário e retorna seus dados
async function getCardForUser(cardId, userId) {
  const result = await query(
    'SELECT * FROM cards WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
    [cardId, userId]
  );
  return result.rows[0] || null;
}

// Helper: garante que a fatura existe, criando se necessário
export async function ensureInvoice(card, purchaseDate) {
  const date = new Date(purchaseDate);
  let month = date.getMonth() + 1;
  let year  = date.getFullYear();

  let closingDate = null;
  let dueDate = null;

  if (card.type === 'debit' || card.type === 'account') {
    // Débito: cai no próprio mês da compra, sem vencimento específico
    const lastDay = new Date(year, month, 0); // último dia do mês atual
    closingDate = lastDay;
    dueDate = lastDay;
  } else {
    // Crédito: verifica se a compra passou do dia de fechamento
    // Se a data de compra for maior ou igual ao dia de fechamento, cai no próximo mês.
    if (date.getDate() >= card.closing_day) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    // O fechamento será no mês atual/próximo dependendo da lógica acima
    // Ex: Compra dia 10, fecha dia 5 -> caiu pro mês seguinte (ex: Agosto)
    // O fechamento de Agosto será: 5 de Agosto
    closingDate = clampDate(year, month, card.closing_day);
    
    // Vencimento de Agosto
    dueDate = card.due_day >= card.closing_day
      ? clampDate(year, month, card.due_day)
      : clampDate(year, month + 1, card.due_day);
  }

  let status = 'open';
  if (card.type === 'debit' || card.type === 'account') {
    status = 'paid';
  }

  const result = await query(
    `INSERT INTO invoices (card_id, month, year, closing_date, due_date, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (card_id, month, year) DO UPDATE SET due_date = EXCLUDED.due_date, status = EXCLUDED.status
     RETURNING *`,
    [card.id, month, year, closingDate, dueDate, status]
  );
  return result.rows[0];
}

// GET /api/expenses — filtrado pelo user_id via JOIN com cards
router.get('/', async (req, res) => {
  try {
    const { card_id, month, year, category, source } = req.query;
    let sql = `
      SELECT e.*, i.month, i.year, c.name AS card_name, c.color AS card_color, c.brand AS card_brand
      FROM expenses e
      JOIN invoices i ON e.invoice_id = i.id
      JOIN cards c ON e.card_id = c.id
      WHERE c.user_id = $1`;
    const params = [req.userId];
    let idx = 2;

    if (card_id) { sql += ` AND e.card_id = $${idx++}`; params.push(card_id); }
    if (month)   { sql += ` AND i.month = $${idx++}`;   params.push(month); }
    if (year)    { sql += ` AND i.year = $${idx++}`;    params.push(year); }
    if (category){ sql += ` AND e.category = $${idx++}`;params.push(category); }
    if (source)  { sql += ` AND e.source = $${idx++}`;  params.push(source); }

    sql += ' ORDER BY e.purchase_date DESC, e.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/expenses/installments — busca todas as compras parceladas agrupadas
router.get('/installments', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        e.card_id, c.name as card_name, c.color as card_color, c.brand as card_brand, e.description, e.purchase_date, e.category,
        SUM(e.amount) as total_amount,
        MAX(e.amount) as installment_amount,
        MAX(e.installment_total) as total_installments,
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_installments
      FROM expenses e
      JOIN invoices i ON e.invoice_id = i.id
      JOIN cards c ON e.card_id = c.id
      WHERE c.user_id = $1 AND e.installment_total > 1
      GROUP BY e.card_id, c.name, c.color, c.brand, e.description, e.purchase_date, e.category
      ORDER BY e.purchase_date DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const {
      card_id, description, category, amount,
      installment_total = 1, purchase_date, source = 'manual', notes
    } = req.body;

    if (!card_id || !description || !amount) {
      return res.status(400).json({ error: 'Campos obrigatórios: card_id, description, amount' });
    }

    // Validar que o cartão pertence ao usuário
    const card = await getCardForUser(card_id, req.userId);
    if (!card) return res.status(404).json({ error: 'Cartão não encontrado' });

    const date = purchase_date ? new Date(purchase_date) : new Date();
    const installmentAmount = parseFloat(amount) / parseInt(installment_total);
    const createdExpenses = [];

    for (let i = 1; i <= parseInt(installment_total); i++) {
      const installmentDate = new Date(date);
      installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

      const invoice = await ensureInvoice(card, installmentDate);
      const result = await query(
        `INSERT INTO expenses
          (invoice_id, card_id, description, category, amount, installment_current, installment_total, purchase_date, source, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          invoice.id, card.id, description,
          category || 'outros',
          installmentAmount.toFixed(2),
          i, parseInt(installment_total),
          installmentDate.toISOString().split('T')[0],
          source, notes
        ]
      );
      createdExpenses.push(result.rows[0]);
    }

    if (card.type === 'debit' || card.type === 'account') {
      await query(`UPDATE cards SET balance = balance - $1 WHERE id = $2`, [amount, card.id]);
    }

    res.status(201).json({
      message: `${installment_total} parcela(s) criada(s)`,
      expenses: createdExpenses,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/expenses/bulk
router.post('/bulk', async (req, res) => {
  try {
    const { card_id, expenses } = req.body;
    
    if (!card_id || !Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ error: 'Forneça card_id e uma array de expenses.' });
    }

    const card = await getCardForUser(card_id, req.userId);
    if (!card) return res.status(404).json({ error: 'Cartão não encontrado.' });

    let totalAmount = 0;
    const createdExpenses = [];

    for (const exp of expenses) {
      const amount = parseFloat(exp.amount) || 0;
      if (amount <= 0) continue;

      const date = exp.date ? new Date(exp.date) : new Date();
      const invoice = await ensureInvoice(card, date);
      
      const instCurr = parseInt(exp.installment_current) || 1;
      const instTotal = parseInt(exp.installment_total) || 1;

      const result = await query(
        `INSERT INTO expenses
          (invoice_id, card_id, description, category, amount, installment_current, installment_total, purchase_date, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import') RETURNING *`,
        [
          invoice.id, card.id, exp.description || 'Gasto importado',
          exp.category || 'outros', amount.toFixed(2),
          instCurr, instTotal,
          date.toISOString().split('T')[0]
        ]
      );
      createdExpenses.push(result.rows[0]);
      totalAmount += amount;
    }

    if (card.type === 'debit' || card.type === 'account') {
      await query(`UPDATE cards SET balance = balance - $1 WHERE id = $2`, [totalAmount, card.id]);
    }

    res.status(201).json({ message: `${createdExpenses.length} gastos criados.`, expenses: createdExpenses });
  } catch (err) {
    console.error('Erro no bulk insert:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    // Verifica que o gasto pertence ao usuário e pega o valor atual + tipo de cartão
    const check = await query(
      `SELECT e.id, e.amount as old_amount, e.card_id, c.type 
       FROM expenses e JOIN cards c ON e.card_id = c.id
       WHERE e.id = $1 AND c.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Gasto não encontrado' });

    const { description, category, amount, purchase_date, notes, installment_current, installment_total } = req.body;
    
    // Atualiza o saldo se for débito/conta e o valor mudou
    if ((check.rows[0].type === 'debit' || check.rows[0].type === 'account') && amount !== undefined) {
      const diff = amount - check.rows[0].old_amount;
      if (diff !== 0) {
        await query(`UPDATE cards SET balance = balance - $1 WHERE id = $2`, [diff, check.rows[0].card_id]);
      }
    }

    const result = await query(
      `UPDATE expenses SET
        description = COALESCE($1, description),
        category    = COALESCE($2, category),
        amount      = COALESCE($3, amount),
        purchase_date = COALESCE($4, purchase_date),
        notes       = COALESCE($5, notes),
        installment_current = COALESCE($6, installment_current),
        installment_total = COALESCE($7, installment_total)
       WHERE id = $8 RETURNING *`,
      [description, category, amount, purchase_date, notes, installment_current, installment_total, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const check = await query(
      `SELECT e.id, e.amount, e.card_id, c.type 
       FROM expenses e JOIN cards c ON e.card_id = c.id
       WHERE e.id = $1 AND c.user_id = $2`,
      [req.params.id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Gasto não encontrado' });

    const exp = check.rows[0];
    
    // Estorna saldo se for conta/débito
    if (exp.type === 'debit' || exp.type === 'account') {
      await query(`UPDATE cards SET balance = balance + $1 WHERE id = $2`, [exp.amount, exp.card_id]);
    }

    await query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Gasto removido' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
