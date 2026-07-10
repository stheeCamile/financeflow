import { query } from '../db/connection.js';
import { ensureInvoice } from '../routes/expenses.js';

/**
 * Processa as assinaturas do dia.
 * Chama ensureInvoice para obter a fatura correta e adiciona a despesa.
 */
export async function processSubscriptions() {
  const today = new Date();
  const day = today.getDate();
  const todayStr = today.toISOString().split('T')[0];

  try {
    // 1. Busca todas as assinaturas ativas cujo billing_day é hoje
    const { rows: subscriptions } = await query(`
      SELECT * FROM subscriptions 
      WHERE is_active = TRUE AND billing_day = $1
    `, [day]);

    for (const sub of subscriptions) {
      // 2. Verifica se já processou hoje
      const historyRes = await query(`
        SELECT id FROM subscription_history 
        WHERE subscription_id = $1 AND processed_date = $2
      `, [sub.id, todayStr]);

      if (historyRes.rowCount > 0) {
        continue; // Já cobrado hoje
      }

      // 3. Obtém o cartão e a fatura correta
      const cardRes = await query(`SELECT * FROM cards WHERE id = $1`, [sub.card_id]);
      const card = cardRes.rows[0];
      if (!card) continue;

      const invoice = await ensureInvoice(card, todayStr);

      // 4. Insere a despesa
      const expenseRes = await query(`
        INSERT INTO expenses (invoice_id, card_id, description, category, amount, purchase_date, source)
        VALUES ($1, $2, $3, $4, $5, $6, 'manual')
        RETURNING id
      `, [invoice.id, sub.card_id, sub.description, sub.category, sub.amount, todayStr]);
      
      const expenseId = expenseRes.rows[0].id;

      // 5. Registra no histórico para não cobrar duas vezes
      await query(`
        INSERT INTO subscription_history (subscription_id, processed_date, expense_id)
        VALUES ($1, $2, $3)
      `, [sub.id, todayStr, expenseId]);

      console.log(`✅ Assinatura processada: ${sub.description} (${sub.amount})`);
    }
  } catch (err) {
    console.error('❌ Erro ao processar assinaturas automáticas:', err);
  }
}
