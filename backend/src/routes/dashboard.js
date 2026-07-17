import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateDashboardSummary } from '../services/ai.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year  = req.query.year  || new Date().getFullYear();
    const uid   = req.userId;

    const totalSpentRes = await query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN invoices i ON e.invoice_id = i.id
       JOIN cards c ON i.card_id = c.id
       WHERE i.month = $1 AND i.year = $2 AND c.user_id = $3`,
      [month, year, uid]
    );

    const totalRevenueRes = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM revenues
       WHERE EXTRACT(MONTH FROM received_date) = $1
         AND EXTRACT(YEAR FROM received_date) = $2
         AND user_id = $3`,
      [month, year, uid]
    );

    const categoryRes = await query(
      `SELECT e.category, COALESCE(SUM(e.amount), 0) AS total, COUNT(*) AS count
       FROM expenses e
       JOIN invoices i ON e.invoice_id = i.id
       JOIN cards c ON i.card_id = c.id
       WHERE i.month = $1 AND i.year = $2 AND c.user_id = $3
       GROUP BY e.category ORDER BY total DESC`,
      [month, year, uid]
    );

    const cardSpentRes = await query(
      `SELECT c.id, c.name, c.brand, c.color, c.limit_amount,
        COALESCE(SUM(e.amount), 0) AS spent
       FROM cards c
       LEFT JOIN invoices i ON i.card_id = c.id AND i.month = $1 AND i.year = $2
       LEFT JOIN expenses e ON e.invoice_id = i.id
       WHERE c.is_active = TRUE AND c.user_id = $3
       GROUP BY c.id ORDER BY spent DESC`,
      [month, year, uid]
    );

    const upcomingRes = await query(
      `SELECT i.*, c.name AS card_name, c.brand AS card_brand, c.color AS card_color
       FROM invoices i
       JOIN cards c ON i.card_id = c.id
       WHERE i.status != 'paid'
         AND i.due_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
         AND c.user_id = $1
       ORDER BY i.due_date ASC LIMIT 5`,
      [uid]
    );

    const paymentMethodsRes = await query(
      `SELECT c.type, COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN invoices i ON e.invoice_id = i.id
       JOIN cards c ON i.card_id = c.id
       WHERE i.month = $1 AND i.year = $2 AND c.user_id = $3
       GROUP BY c.type`,
      [month, year, uid]
    );

    const goalsRes = await query(
      `SELECT *, ROUND((current_amount / NULLIF(target_amount, 0)) * 100, 1) AS progress_percent
       FROM goals WHERE is_completed = FALSE AND user_id = $1
       ORDER BY progress_percent DESC LIMIT 3`,
      [uid]
    );

    const settingsRes = await query(
      `SELECT value FROM settings WHERE key = 'monthly_limit_global' AND user_id = $1`,
      [uid]
    );
    const monthlyLimit = parseFloat(settingsRes.rows[0]?.value || 0);

    const netWorthRes = await query(
      `SELECT COALESCE(SUM(balance), 0) AS total FROM cards WHERE type IN ('account', 'debit') AND is_active = TRUE AND user_id = $1`,
      [uid]
    );
    const futureRevRes = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM revenues WHERE received_date > CURRENT_DATE AND account_id IS NOT NULL AND user_id = $1`,
      [uid]
    );
    const futureExpRes = await query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e JOIN cards c ON e.card_id = c.id WHERE c.type IN ('account', 'debit') AND e.purchase_date > CURRENT_DATE AND c.user_id = $1`,
      [uid]
    );
    const totalNetWorth = parseFloat(netWorthRes.rows[0].total) - parseFloat(futureRevRes.rows[0].total) + parseFloat(futureExpRes.rows[0].total);

    const totalSpent   = parseFloat(totalSpentRes.rows[0].total);
    const totalRevenue = parseFloat(totalRevenueRes.rows[0].total);

    res.json({
      month: parseInt(month), year: parseInt(year),
      total_spent: totalSpent, total_revenue: totalRevenue,
      balance: totalRevenue - totalSpent,
      total_net_worth: totalNetWorth,
      monthly_limit: monthlyLimit,
      limit_percent: monthlyLimit > 0 ? Math.min((totalSpent / monthlyLimit) * 100, 100).toFixed(1) : 0,
      categories: categoryRes.rows,
      cards: cardSpentRes.rows,
      upcoming_invoices: upcomingRes.rows,
      goals: goalsRes.rows,
      paymentMethods: paymentMethodsRes.rows.map(r => ({
        type: r.type,
        total: parseFloat(r.total),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/evolution', async (req, res) => {
  try {
    const uid = req.userId;
    const result = await query(
      `SELECT i.month, i.year,
        COALESCE(SUM(e.amount), 0) AS total_spent,
        (SELECT COALESCE(SUM(amount), 0) FROM revenues r
         WHERE EXTRACT(MONTH FROM r.received_date) = i.month
           AND EXTRACT(YEAR FROM r.received_date) = i.year
           AND r.user_id = $1) AS total_revenue
       FROM invoices i
       LEFT JOIN expenses e ON e.invoice_id = i.id
       JOIN cards c ON i.card_id = c.id
       WHERE c.user_id = $1
         AND (i.year * 100 + i.month) >=
             (EXTRACT(YEAR FROM NOW())::int * 100 + EXTRACT(MONTH FROM NOW())::int - 5)
       GROUP BY i.month, i.year
       ORDER BY i.year ASC, i.month ASC`,
      [uid]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/ai-summary', async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year  = req.query.year  || new Date().getFullYear();
    const summary = await generateDashboardSummary(req.userId, month, year);
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar resumo da IA' });
  }
});

export default router;
