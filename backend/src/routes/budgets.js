import { Router } from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const CATEGORIES = ['alimentacao', 'transporte', 'saude', 'lazer', 'educacao', 'casa', 'roupas', 'outros'];

router.get('/', async (req, res) => {
  try {
    // 1. Pega os limites cadastrados
    const budgetsRes = await query(`SELECT category, amount FROM category_budgets WHERE user_id = $1`, [req.userId]);
    const budgetsMap = {};
    budgetsRes.rows.forEach(r => { budgetsMap[r.category] = parseFloat(r.amount); });

    // 2. Pega os gastos do mês atual
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const expensesRes = await query(`
      SELECT e.category, SUM(e.amount) as spent
      FROM expenses e
      JOIN cards c ON e.card_id = c.id
      WHERE c.user_id = $1 AND e.purchase_date >= $2 AND e.purchase_date <= $3
      GROUP BY e.category
    `, [req.userId, firstDay, lastDay]);

    const spentMap = {};
    expensesRes.rows.forEach(r => { spentMap[r.category] = parseFloat(r.spent); });

    // 3. Monta o array final com todas as categorias padrão
    const result = CATEGORIES.map(cat => ({
      category: cat,
      budget_amount: budgetsMap[cat] || 0,
      spent_amount: spentMap[cat] || 0
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar orçamentos' });
  }
});

router.put('/', async (req, res) => {
  const { budgets } = req.body; // array de { category, amount }
  if (!Array.isArray(budgets)) return res.status(400).json({ error: 'Formato inválido' });

  try {
    // Upsert para cada categoria
    for (const b of budgets) {
      if (CATEGORIES.includes(b.category)) {
        await query(`
          INSERT INTO category_budgets (user_id, category, amount)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, category) 
          DO UPDATE SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP
        `, [req.userId, b.category, b.amount]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar orçamentos' });
  }
});

export default router;
