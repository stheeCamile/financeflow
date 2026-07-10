import express from 'express';
import { connectWhatsApp, getQRCode, getStatus, disconnectWhatsApp } from '../whatsapp/bot.js';
import { query } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/whatsapp/status
router.get('/status', (_req, res) => {
  res.json({ status: getStatus() });
});

// GET /api/whatsapp/qrcode — retorna QR Code aguardando até 30s
router.get('/qrcode', async (_req, res) => {
  const status = getStatus();
  if (status === 'connected') {
    return res.json({ status: 'connected', qr: null });
  }

  if (status === 'disconnected') {
    connectWhatsApp().catch(console.error);
  }

  let attempts = 0;
  const interval = setInterval(() => {
    const qr = getQRCode();
    const st = getStatus();
    attempts++;

    if (qr || st === 'connected' || attempts > 30) {
      clearInterval(interval);
      res.json({ status: st, qr });
    }
  }, 1000);
});

// POST /api/whatsapp/connect
router.post('/connect', async (_req, res) => {
  if (getStatus() === 'connected') {
    return res.json({ message: 'Já conectado' });
  }
  connectWhatsApp().catch(console.error);
  res.json({ message: 'Iniciando conexão...' });
});

// POST /api/whatsapp/disconnect
router.post('/disconnect', async (_req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ message: 'WhatsApp desconectado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/whatsapp/number — salva o número vinculado a este usuário
router.put('/number', async (req, res) => {
  try {
    const { number } = req.body;
    const normalized = (number || '').replace(/\D/g, '');

    await query(
      `INSERT INTO settings (key, value, user_id) VALUES ('whatsapp_number', $1, $2)
       ON CONFLICT (key, user_id) DO UPDATE SET value = $1, updated_at = NOW()`,
      [normalized, req.userId]
    );
    res.json({ message: 'Número configurado com sucesso', number: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import { generateDailyAnalysis } from '../services/ai.js';
import { sendWhatsAppMessage } from '../whatsapp/bot.js';

// POST /api/whatsapp/test-ai
router.post('/test-ai', async (req, res) => {
  try {
    const settings = await query(`SELECT key, value FROM settings WHERE user_id = $1`, [req.userId]);
    const settingsMap = settings.rows.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    
    if (!settingsMap.gemini_api_key) return res.status(400).json({ error: 'Chave da API do Gemini não configurada' });
    if (!settingsMap.whatsapp_lid) return res.status(400).json({ error: 'WhatsApp não vinculado. Envie "oi" para o bot primeiro.' });

    const message = await generateDailyAnalysis(req.userId);
    if (!message) return res.status(500).json({ error: 'Não foi possível gerar a análise da IA.' });

    const jid = settingsMap.whatsapp_lid.includes('@') ? settingsMap.whatsapp_lid : `${settingsMap.whatsapp_lid}@lid`;
    console.log(`[test-ai] Enviando msg para JID: ${jid}`);
    const success = await sendWhatsAppMessage(jid, message);
    console.log(`[test-ai] Sucesso no disparo: ${success}`);
    res.json({ message: 'Análise gerada e enviada para o seu WhatsApp!' });
  } catch (err) {
    console.error('Erro no test-ai:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

