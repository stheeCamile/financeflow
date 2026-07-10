import express from 'express';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT key, value FROM settings WHERE user_id = $1 ORDER BY key',
      [req.userId]
    );
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });

    // Garantir defaults se não existirem
    if (!settings.monthly_limit_global) settings.monthly_limit_global = '3000';
    if (!settings.monthly_limit_per_card) settings.monthly_limit_per_card = 'false';
    if (settings.whatsapp_number === undefined) settings.whatsapp_number = '';

    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    const keys = Object.keys(updates);
    if (keys.length === 0) return res.status(400).json({ error: 'Nenhuma configuração fornecida' });

    for (const key of keys) {
      await query(
        `INSERT INTO settings (key, value, user_id) VALUES ($1, $2, $3)
         ON CONFLICT (key, user_id) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(updates[key]), req.userId]
      );
    }

    const result = await query(
      'SELECT key, value FROM settings WHERE user_id = $1 ORDER BY key',
      [req.userId]
    );
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
