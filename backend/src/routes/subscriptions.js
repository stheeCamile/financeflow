import { Router } from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 1. Listar assinaturas do usuário
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT s.*, c.name as card_name, c.type as card_type 
      FROM subscriptions s
      JOIN cards c ON s.card_id = c.id
      WHERE s.user_id = $1
      ORDER BY s.is_active DESC, s.billing_day ASC
    `, [req.userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar assinaturas' });
  }
});

// 2. Criar nova assinatura
router.post('/', async (req, res) => {
  const { card_id, description, category, amount, billing_day } = req.body;
  if (!card_id || !description || !category || !amount || !billing_day) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
  }

  try {
    // Validar se o cartão pertence ao usuário
    const cardRes = await query(`SELECT id FROM cards WHERE id = $1 AND user_id = $2`, [card_id, req.userId]);
    if (cardRes.rowCount === 0) {
      return res.status(403).json({ error: 'Cartão não encontrado ou não pertence ao usuário' });
    }

    const { rows } = await query(`
      INSERT INTO subscriptions (user_id, card_id, description, category, amount, billing_day)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.userId, card_id, description, category, amount, billing_day]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar assinatura' });
  }
});

// 3. Atualizar assinatura (incluindo pausar/ativar)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { card_id, description, category, amount, billing_day, is_active } = req.body;

  try {
    const checkRes = await query(`SELECT id FROM subscriptions WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const { rows } = await query(`
      UPDATE subscriptions 
      SET card_id = COALESCE($1, card_id),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          amount = COALESCE($4, amount),
          billing_day = COALESCE($5, billing_day),
          is_active = COALESCE($6, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `, [card_id, description, category, amount, billing_day, is_active, id, req.userId]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar assinatura' });
  }
});

// 4. Excluir assinatura
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await query(`DELETE FROM subscriptions WHERE id = $1 AND user_id = $2`, [req.params.id, req.userId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Assinatura não encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir assinatura' });
  }
});

export default router;
