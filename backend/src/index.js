import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

import authRouter     from './routes/auth.js';
import cardsRouter    from './routes/cards.js';
import invoicesRouter from './routes/invoices.js';
import expensesRouter from './routes/expenses.js';
import revenuesRouter from './routes/revenues.js';
import goalsRouter    from './routes/goals.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import whatsappRouter from './routes/whatsapp.js';
import subscriptionsRouter from './routes/subscriptions.js';
import budgetsRouter from './routes/budgets.js';
import importRouter  from './routes/import.js';
import { connectWhatsApp } from './whatsapp/bot.js';
import { startScheduler } from './scheduler.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'https://financeflow-seven-nu.vercel.app'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRouter);
app.use('/api/cards',         cardsRouter);
app.use('/api/invoices',      invoicesRouter);
app.use('/api/expenses',      expensesRouter);
app.use('/api/revenues',      revenuesRouter);
app.use('/api/dashboard',     dashboardRouter);
app.use('/api/goals',         goalsRouter);
app.use('/api/settings',      settingsRouter);
app.use('/api/whatsapp',      whatsappRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/budgets',       budgetsRouter);
app.use('/api/import',        importRouter);

// ── Tratamento de erros ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FinanceFlow API — porta ${PORT} | ${process.env.NODE_ENV || 'development'}`);

  // Auto-reconecta WhatsApp se existir sessão salva
  const sessionPath = './whatsapp-session';
  if (fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0) {
    console.log('📱 Sessão WhatsApp encontrada — reconectando...');
    connectWhatsApp().catch(err => {
      console.warn('⚠️  Falha na reconexão WhatsApp:', err.message);
    });
  } else {
    console.log('📱 WhatsApp: escaneie o QR Code no app para conectar.');
  }

  // Inicia o Scheduler de IA
  startScheduler();
});

export default app;
