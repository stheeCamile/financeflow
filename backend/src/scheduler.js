import cron from 'node-cron';
import { query } from './db/connection.js';
import { generateDailyAnalysis, generateWeeklyAnalysis } from './services/ai.js';
import { sendWhatsAppMessage } from './whatsapp/bot.js';
import { processSubscriptions } from './services/subscriptionService.js';

/**
 * Pega usuários elegíveis para receber dicas da IA via WhatsApp.
 * Um usuário é elegível se tiver whatsapp_lid, gemini_api_key e ai_daily_enabled != 'false'
 */
async function getEligibleUsers() {
  const res = await query(`
    SELECT u.id as user_id, 
           MAX(CASE WHEN s.key = 'whatsapp_lid' THEN s.value END) as whatsapp_lid,
           MAX(CASE WHEN s.key = 'gemini_api_key' THEN s.value END) as gemini_api_key,
           MAX(CASE WHEN s.key = 'ai_daily_enabled' THEN s.value END) as ai_daily_enabled
    FROM users u
    JOIN settings s ON u.id = s.user_id
    GROUP BY u.id
  `);

  return res.rows.filter(u => 
    u.whatsapp_lid && 
    u.gemini_api_key && 
    u.ai_daily_enabled !== 'false'
  );
}

export function startScheduler() {
  console.log('⏰ Iniciando agendador de tarefas (Cron Jobs)...');

  // Job de Assinaturas (01:00 AM)
  cron.schedule('0 1 * * *', async () => {
    console.log('🔄 Executando processamento de assinaturas...');
    await processSubscriptions();
  });

  // Job Diário às 20:00 (Hora local do servidor)
  cron.schedule('0 20 * * *', async () => {
    console.log('🤖 Executando Análise Diária da IA...');
    const users = await getEligibleUsers();
    
    for (const user of users) {
      try {
        const message = await generateDailyAnalysis(user.user_id);
        if (message) {
          await sendWhatsAppMessage(user.whatsapp_lid, message);
          console.log(`✅ Análise diária enviada para usuário ${user.user_id}`);
        }
      } catch (err) {
        console.error(`Erro ao processar análise diária para ${user.user_id}:`, err);
      }
    }
  });

  // Job Semanal aos Domingos às 19:00
  cron.schedule('0 19 * * 0', async () => {
    console.log('🤖 Executando Análise Semanal da IA...');
    const users = await getEligibleUsers();
    
    for (const user of users) {
      try {
        const message = await generateWeeklyAnalysis(user.user_id);
        if (message) {
          await sendWhatsAppMessage(user.whatsapp_lid, message);
          console.log(`✅ Análise semanal enviada para usuário ${user.user_id}`);
        }
      } catch (err) {
        console.error(`Erro ao processar análise semanal para ${user.user_id}:`, err);
      }
    }
  });
}
