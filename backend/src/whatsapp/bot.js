import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { query } from '../db/connection.js';
import { parseMessage } from './parser.js';

const logger = pino({ level: 'silent' });

let sock = null;
let qrCodeBase64 = null;
let connectionStatus = 'disconnected';

/**
 * Encontra o usuário pelo número ou pelo @lid do WhatsApp Business.
 * Tenta 3 estratégias em ordem:
 *   1. Match exato pelo lid salvo em 'whatsapp_lid'
 *   2. Match por sufixo dos últimos 8 dígitos do número
 *   3. Se achou pelo sufixo, salva o lid para próximas msgs (auto-aprendizado)
 */
async function findUserByPhone(senderRaw, isLid = false) {
  const digitsOnly = senderRaw.replace(/\D/g, '');

  // 1. Se for @lid, tenta match direto pelo lid salvo
  if (isLid) {
    const lidResult = await query(
      `SELECT s.user_id, u.name, u.email
       FROM settings s
       JOIN users u ON s.user_id = u.id
       WHERE s.key = 'whatsapp_lid' AND s.value = $1
       LIMIT 1`,
      [digitsOnly]
    );
    if (lidResult.rows.length > 0) return lidResult.rows[0];
  }

  // 2. Match por sufixo do número de telefone (últimos 8 dígitos)
  const suffix = digitsOnly.slice(-8);
  const phoneResult = await query(
    `SELECT s.user_id, u.name, u.email
     FROM settings s
     JOIN users u ON s.user_id = u.id
     WHERE s.key = 'whatsapp_number'
       AND REPLACE(REPLACE(s.value, '+', ''), ' ', '') LIKE $1
     LIMIT 1`,
    [`%${suffix}`]
  );

  if (phoneResult.rows.length > 0) {
    // 3. Salva o lid para evitar busca por sufixo nas próximas vezes
    if (isLid && digitsOnly) {
      const userId = phoneResult.rows[0].user_id;
      await query(
        `INSERT INTO settings (key, value, user_id) VALUES ('whatsapp_lid', $1, $2)
         ON CONFLICT (key, user_id) DO UPDATE SET value = $1`,
        [digitsOnly, userId]
      ).catch(() => {}); // ignora erro silenciosamente
    }
    return phoneResult.rows[0];
  }

  return null;
}


/**
 * Encontra cartão pelo nome, filtrando pelo usuário e tentando identificar o tipo
 */
async function findCardByName(cardName, userId) {
  if (!cardName) return null;
  let typeFilter = '';
  let params = [userId, `%${cardName}%`];
  let searchName = cardName.toLowerCase();
  
  if (searchName.includes('debito') || searchName.includes('débito')) {
    typeFilter = " AND type = 'debit'";
    searchName = searchName.replace(/debito|débito/g, '').trim();
  } else if (searchName.includes('credito') || searchName.includes('crédito')) {
    typeFilter = " AND type = 'credit'";
    searchName = searchName.replace(/credito|crédito/g, '').trim();
  } else if (searchName.includes('pix') || searchName.includes('conta')) {
    typeFilter = " AND type = 'account'";
    searchName = searchName.replace(/pix|conta/g, '').trim();
  }
  
  // Se sobrou algum nome, usa no LIKE, senao busca só pelo tipo
  if (searchName.length > 0) {
    params[1] = `%${searchName}%`;
  } else {
    // Se digitou só "debito" ou "pix", pegamos o primeiro cartao/conta
    return (await query(`SELECT id, name, type FROM cards WHERE is_active = TRUE AND user_id = $1 ${typeFilter} LIMIT 1`, [userId])).rows[0] || null;
  }

  const result = await query(
    `SELECT id, name, type FROM cards
     WHERE is_active = TRUE AND user_id = $1 AND LOWER(name) LIKE $2 ${typeFilter}
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

function clampDate(year, month, day) {
  // get the last day of the given month
  const lastDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return new Date(year, month - 1, clampedDay);
}

/**
 * Garante que a fatura do mês existe
 */
async function ensureInvoice(card_id, purchaseDate) {
  const date = new Date(purchaseDate);
  let month = date.getMonth() + 1;
  let year  = date.getFullYear();

  const cardRes = await query('SELECT * FROM cards WHERE id = $1', [card_id]);
  if (cardRes.rows.length === 0) return null;
  const card = cardRes.rows[0];

  let closingDate = null;
  let dueDate = null;

  if (card.type === 'debit' || card.type === 'account') {
    // Débito: cai no próprio mês da compra, sem vencimento específico
    const lastDay = new Date(year, month, 0);
    closingDate = lastDay;
    dueDate = lastDay;
  } else {
    // Crédito: se a data de compra for maior ou igual ao fechamento, fatura cai no próximo mês
    if (date.getDate() >= card.closing_day) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    closingDate = clampDate(year, month, card.closing_day);
    dueDate = card.due_day >= card.closing_day
      ? clampDate(year, month, card.due_day)
      : clampDate(year, month + 1, card.due_day);
  }

  const result = await query(
    `INSERT INTO invoices (card_id, month, year, closing_date, due_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (card_id, month, year) DO UPDATE SET due_date = EXCLUDED.due_date
     RETURNING *`,
    [card_id, month, year, closingDate, dueDate]
  );
  return result.rows[0];
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function buildProgressBar(percent, size = 10) {
  const filled = Math.round((percent / 100) * size);
  return '█'.repeat(Math.min(filled, size)) + '░'.repeat(Math.max(size - filled, 0));
}

/**
 * Processa mensagem no contexto de um usuário específico
 */
async function processMessage(text, userId) {
  const parsed = parseMessage(text);

  if (parsed.type === 'unknown') {
    return `❓ Não entendi. Tente:\n• "gastei 150 com mercado no nubank"\n• "paguei 89,90 de gasolina no itau em 3x"\n• "recebi 3000 de salário"`;
  }

  if (parsed.type === 'revenue') {
    const { amount, description, category } = parsed.data;
    await query(
      `INSERT INTO revenues (description, category, amount, user_id) VALUES ($1, $2, $3, $4)`,
      [description, category, amount, userId]
    );

    const now = new Date();
    const monthRevTotal = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM revenues
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM received_date) = $2
         AND EXTRACT(YEAR FROM received_date) = $3`,
      [userId, now.getMonth() + 1, now.getFullYear()]
    );

    return `✅ Receita registrada!\n💰 ${description} — ${formatMoney(amount)}\n\n📊 Total de receitas em ${now.toLocaleString('pt-BR', { month: 'long' })}: ${formatMoney(monthRevTotal.rows[0].total)}`;
  }

  if (parsed.type === 'expense') {
    const { amount, description, category, card_name, installment_total, purchase_date } = parsed.data;

    const card = await findCardByName(card_name, userId);
    if (!card) {
      return `❌ Cartão "${card_name || 'não identificado'}" não encontrado.\nCadastre o cartão no app ou verifique o nome.`;
    }

    const installmentAmount = amount / installment_total;
    const now = new Date();

    let firstInvoice = null;

    for (let i = 1; i <= installment_total; i++) {
      const installDate = new Date(now);
      installDate.setMonth(installDate.getMonth() + (i - 1));
      const invoice = await ensureInvoice(card.id, installDate);
      if (!invoice) continue;
      if (i === 1) firstInvoice = invoice; // guarda a primeira fatura para usar no resumo

      await query(
        `INSERT INTO expenses (invoice_id, card_id, description, category, amount, installment_current, installment_total, purchase_date, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'whatsapp')`,
        [invoice.id, card.id, description, category, installmentAmount.toFixed(2), i, installment_total, installDate.toISOString().split('T')[0]]
      );
    }

    const limitRes = await query(
      `SELECT value FROM settings WHERE key = 'monthly_limit_global' AND user_id = $1`,
      [userId]
    );
    const monthlyLimit = parseFloat(limitRes.rows[0]?.value || 0);

    const monthSpentRes = await query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e JOIN invoices i ON e.invoice_id = i.id JOIN cards c ON e.card_id = c.id
       WHERE i.month = $1 AND i.year = $2 AND c.user_id = $3`,
      [firstInvoice ? firstInvoice.month : now.getMonth() + 1, firstInvoice ? firstInvoice.year : now.getFullYear(), userId]
    );
    const monthSpent = parseFloat(monthSpentRes.rows[0].total);

    const invoiceRes = await query(
      `SELECT i.total_amount, i.due_date FROM invoices i
       WHERE i.id = $1`,
      [firstInvoice?.id]
    );
    const invoice = invoiceRes.rows[0];

    const limitPercent = monthlyLimit > 0 ? Math.round((monthSpent / monthlyLimit) * 100) : 0;
    const bar = buildProgressBar(limitPercent);
    const dueDate = invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('pt-BR') : 'N/A';
    const daysLeft = invoice?.due_date ? Math.ceil((new Date(invoice.due_date) - now) / (1000 * 60 * 60 * 24)) : null;

    const parcInfo = installment_total > 1
      ? ` (1/${installment_total} × ${formatMoney(installmentAmount)})`
      : '';

    let alert = '';
    if (limitPercent >= 90) alert = '\n⚠️ *ATENÇÃO: Quase no limite mensal!*';
    else if (limitPercent >= 75) alert = '\n⚡ Você já usou mais de 75% do limite.';

    const targetMonthName = firstInvoice 
      ? new Date(firstInvoice.year, firstInvoice.month - 1).toLocaleString('pt-BR', { month: 'long' })
      : now.toLocaleString('pt-BR', { month: 'long' });

    let tipoTxt = card.type === 'debit' ? 'Débito' : card.type === 'account' ? 'Conta/Pix' : 'Crédito';

    return `✅ Gasto registrado!
📦 ${description}${parcInfo}
💳 ${card.name} (${tipoTxt}) — ${formatMoney(amount)}

📊 *Limite mensal (${targetMonthName}):*
   ${formatMoney(monthSpent)} de ${formatMoney(monthlyLimit)} (${limitPercent}%)
   ${bar} ${limitPercent}%${alert}

🧾 *Fatura/Extrato ${card.name}:*
   Total: ${formatMoney(invoice?.total_amount || 0)}
   ${daysLeft !== null && card.type !== 'debit' ? `Vence em: ${daysLeft} dias (${dueDate})` : ''}`;
  }

  return '❓ Não consegui processar a mensagem.';
}

export async function sendWhatsAppMessage(jid, text) {
  if (!sock || connectionStatus !== 'connected') {
    console.log('⚠️ WhatsApp não conectado, impossível enviar mensagem.');
    return false;
  }
  try {
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.error('❌ Erro ao enviar mensagem WhatsApp:', err);
    return false;
  }
}

export async function connectWhatsApp() {
  if (connectionStatus === 'connected') return;
  connectionStatus = 'connecting';

  const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-session');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version, logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false, // Desabilita sincronização de mensagens para não enviar notificação "sincronizando"
    markOnlineOnConnect: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const QRCode = (await import('qrcode')).default;
      qrCodeBase64 = await QRCode.toDataURL(qr);
      connectionStatus = 'qr_ready';
      console.log('📱 QR Code gerado');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error instanceof Boom
        && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'disconnected';
      qrCodeBase64 = null;
      if (shouldReconnect) {
        console.log('🔄 Reconectando WhatsApp em 5s...');
        setTimeout(connectWhatsApp, 5000);
      }
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeBase64 = null;
      console.log('✅ WhatsApp conectado!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Log RAW — mostra tudo antes de filtrar
    console.log(`\n🔔 upsert type="${type}" msgs=${messages.length}`);
    for (const m of messages) {
      console.log(`   jid="${m.key.remoteJid}" fromMe=${m.key.fromMe} participant="${m.key.participant || '-'}"`);
    }

    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;

      // Ignorar mensagens de grupos — só processar conversas diretas
      if (jid.endsWith('@g.us')) continue;

      // Detecta se é formato @lid (WhatsApp Business / novo sistema)
      const rawSender = msg.key.participant || jid;
      const isLid     = rawSender.endsWith('@lid');
      const senderNumber = rawSender
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '')
        .replace(/\D/g, '');

      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || '';

      if (!text || text.length < 3) continue;

      // ── Debug ──────────────────────────────────────────────
      console.log(`\n📨 Mensagem recebida!`);
      console.log(`   De: ${senderNumber} (isLid=${isLid})`);
      console.log(`   Texto: "${text}"`);
      // ───────────────────────────────────────────────────────

      try {
        const user = await findUserByPhone(senderNumber, isLid);

        if (!user) {
          console.log(`   ⚠️  Número ${senderNumber} não encontrado nas settings.`);
          await sock.sendMessage(jid, {
            text: `❌ Número não cadastrado no FinanceFlow.\n\nAcesse o app, vá em WhatsApp e configure seu número para usar o bot.`
          }, { quoted: msg });
          continue;
        }

        console.log(`   ✅ Usuário identificado: ${user.name} (${user.email})`);
        const response = await processMessage(text, user.user_id);
        await sock.sendMessage(jid, { text: response }, { quoted: msg });
        console.log(`   📤 Resposta enviada.`);
      } catch (err) {
        console.error('❌ Erro ao processar mensagem WhatsApp:', err);
        await sock.sendMessage(jid, { text: '❌ Erro ao processar. Tente novamente.' });
      }
    }
  });
}

export function getQRCode()  { return qrCodeBase64; }
export function getStatus()  { return connectionStatus; }
export async function disconnectWhatsApp() {
  if (sock) {
    await sock.logout();
    sock = null;
    connectionStatus = 'disconnected';
    qrCodeBase64 = null;
  }
}
