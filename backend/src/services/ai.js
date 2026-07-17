import { query } from '../db/connection.js';

/**
 * Função genérica para chamar a API do Gemini
 */
async function callGemini(apiKey, groqApiKey, prompt, retries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 503 && attempt < retries) {
          console.log(`[AI] Gemini Servidor ocupado (503). Tentativa ${attempt} falhou. Tentando de novo em 3 segundos...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        throw new Error(`Gemini API Error: ${errText}`);
      }

      const data = await response.json();
      let text = data.candidates[0].content.parts[0].text;
      return text.trim().replace(/^"|"$/g, '').trim();
    } catch (err) {
      if (attempt === retries) {
        if (groqApiKey) {
          console.log(`[AI] Gemini falhou definitivamente. Tentando Fallback para Groq...`);
          return await callGroq(groqApiKey, prompt);
        }
        throw err;
      }
      console.log(`[AI] Gemini Erro de rede. Tentativa ${attempt} falhou. Tentando de novo em 3 segundos...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

async function callGroq(apiKey, prompt) {
  const url = `https://api.groq.com/openai/v1/chat/completions`;
  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 2048
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error: ${errText}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content;
  return text.trim().replace(/^"|"$/g, '').trim();
}

/**
 * Busca as chaves de API nas configurações do usuário
 */
async function getApiKeys(userId) {
  const res = await query(`SELECT key, value FROM settings WHERE user_id = $1 AND key IN ('gemini_api_key', 'groq_api_key')`, [userId]);
  const keys = { gemini: null, groq: null };
  res.rows.forEach(r => {
    if (r.key === 'gemini_api_key') keys.gemini = r.value;
    if (r.key === 'groq_api_key') keys.groq = r.value;
  });
  return keys;
}

/**
 * Formata moeda para BRL
 */
function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

/**
 * Busca perfil do usuário e metas ativas
 */
async function getUserContext(userId) {
  const profileRes = await query(`SELECT value FROM settings WHERE user_id = $1 AND key = 'ai_user_profile'`, [userId]);
  const profile = profileRes.rows[0]?.value || '';

  const goalsRes = await query(`SELECT name, target_amount, current_amount FROM goals WHERE user_id = $1 AND is_completed = FALSE`, [userId]);
  const goals = goalsRes.rows;

  const budgetsRes = await query(`SELECT category, amount FROM category_budgets WHERE user_id = $1 AND amount > 0`, [userId]);
  const budgets = budgetsRes.rows;

  let context = '';
  if (profile) {
    context += `Perfil do Usuário: ${profile}\n`;
  }
  if (goals.length > 0) {
    context += `Metas Atuais de Economia:\n`;
    goals.forEach(g => {
      context += `- ${g.name}: Já guardou ${formatMoney(g.current_amount)} de ${formatMoney(g.target_amount)}\n`;
    });
  }
  if (budgets.length > 0) {
    context += `Orçamentos por Categoria (Limites Máximos para o mês):\n`;
    budgets.forEach(b => {
      context += `- ${b.category}: ${formatMoney(b.amount)}\n`;
    });
    context += `*Dica: Se o usuário estiver próximo de atingir ou tiver ultrapassado algum desses orçamentos com os gastos de hoje, de um alerta sério.*\n`;
  }
  
  if (context) {
    return `\n--- INFORMAÇÕES DO USUÁRIO ---\n${context}Leve essas informações em consideração ao dar conselhos (como dicas de investimento ou lembretes das metas).\n------------------------------\n`;
  }
  return '';
}

/**
 * Análise Diária (Conselheiro)
 */
export async function generateDailyAnalysis(userId) {
  const keys = await getApiKeys(userId);
  if (!keys.gemini && !keys.groq) return null; // Sem chave, sem análise

  // Gastos de hoje
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const expensesRes = await query(`
    SELECT e.description, e.amount, e.category, c.name as card_name
    FROM expenses e
    JOIN cards c ON e.card_id = c.id
    WHERE c.user_id = $1 AND e.purchase_date = $2
  `, [userId, todayStr]);

  const expenses = expensesRes.rows;
  const totalSpent = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  // Limite mensal global
  const limitRes = await query(`SELECT value FROM settings WHERE user_id = $1 AND key = 'monthly_limit_global'`, [userId]);
  const monthlyLimit = parseFloat(limitRes.rows[0]?.value || 0);
  const userContext = await getUserContext(userId);

  let prompt = `Você é um conselheiro financeiro de um aplicativo chamado FinanceFlow, mandando um WhatsApp curto para o seu cliente.\n`;
  prompt += `Personalidade: Equilibrada. Você sabe elogiar e motivar de verdade quando o usuário economiza ou foca no futuro, mas tem um humor levemente ácido e irônico APENAS se ele gastar com supérfluos (iFood, docinhos, compras por impulso).\n`;
  prompt += `REGRA CRÍTICA: Seja muito direto e curto. Use no MÁXIMO 2 parágrafos curtos. Nada de textos longos.\n`;
  prompt += `O usuário definiu um limite de gastos mensal de ${formatMoney(monthlyLimit)}.\n`;
  prompt += userContext;
  
  if (totalSpent === 0) {
    prompt += `Hoje (${todayStr}) o usuário NÃO GASTOU NADA! Nenhuma despesa registrada.\n`;
    prompt += `Escreva uma mensagem (máximo 2 parágrafos) parabenizando o usuário sinceramente por ter segurado a carteira hoje. Lembre-o de como isso ajuda a conquistar as metas dele (como o apartamento).`;
  } else {
    prompt += `Hoje (${todayStr}) o usuário gastou um total de ${formatMoney(totalSpent)}.\n`;
    prompt += `Aqui estão os gastos de hoje (leia com atenção para não trocar os valores entre si):\n`;
    expenses.forEach(e => {
      prompt += `-> Gasto de ${formatMoney(e.amount)} | O que foi: "${e.description}" (Categoria: ${e.category})\n`;
    });
    prompt += `\nEscreva uma mensagem de WhatsApp curta (máximo 2 parágrafos) com emojis. REGRA: Cite os valores corretos para cada item sem confundi-los! Se foram apenas gastos essenciais (sobrevivência, contas), elogie o controle e foco. Mas se ele gastou com besteiras, lanches ou docinhos, dê um leve puxão de orelha irônico (ex: "O apartamento não se paga com docinho, né?"), mas sem exageros. Termine de forma motivadora.`;
  }

  try {
    return await callGemini(keys.gemini, keys.groq, prompt);
  } catch (err) {
    console.error('Erro na análise diária:', err);
    return null;
  }
}

/**
 * Análise Semanal (Conselheiro)
 */
export async function generateWeeklyAnalysis(userId) {
  const keys = await getApiKeys(userId);
  if (!keys.gemini && !keys.groq) return null;

  const res = await query(`
    SELECT category, SUM(amount) as total
    FROM expenses e JOIN cards c ON e.card_id = c.id
    WHERE c.user_id = $1 AND e.purchase_date >= current_date - interval '7 days'
    GROUP BY category
    ORDER BY total DESC
  `, [userId]);

  const expenses = res.rows;
  const totalSpent = expenses.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
  const userContext = await getUserContext(userId);

  let prompt = `Você é um conselheiro financeiro de WhatsApp.\n`;
  prompt += userContext;
  prompt += `Resumo dos últimos 7 dias do usuário:\nTotal gasto: ${formatMoney(totalSpent)}\n`;
  prompt += `Por categoria:\n`;
  expenses.forEach(e => {
    prompt += `- ${e.category}: ${formatMoney(e.total)}\n`;
  });
  prompt += `\nEscreva uma análise semanal para o WhatsApp (com emojis, amigável mas firme). Destaque a categoria em que ele mais gastou. Dê uma dica prática para a próxima semana.`;

  try {
    return await callGemini(keys.gemini, keys.groq, prompt);
  } catch (err) {
    console.error('Erro na AI Semanal:', err);
    return null;
  }
}

/**
 * Lê o print de uma fatura usando Visão Computacional do Gemini
 */
export async function parseInvoiceImage(userId, base64Data, mimeType) {
  const keys = await getApiKeys(userId);
  if (!keys.gemini) throw new Error('Chave da API do Gemini não configurada (Vá em Configurações > Automação Inteligente)');

  const prompt = `Você é um assistente financeiro especialista em extrair dados de faturas de cartão de crédito e extratos bancários.
Examine o arquivo fornecido (imagem ou PDF) e extraia todos os gastos listados.
Ignore linhas que sejam pagamentos da própria fatura (ex: "Pagamento recebido", "Pagamento de fatura").
Retorne APENAS um array JSON puro (sem formatação markdown e sem explicações).
Formato exato de cada objeto do array:
{
  "date": "YYYY-MM-DD",
  "description": "Nome do estabelecimento/loja",
  "amount": 150.50,
  "category": "alimentacao",
  "installment_current": 1,
  "installment_total": 1
}
Se a descrição indicar parcela (ex: "Compra XPTO 03/10"), preencha "installment_current": 3 e "installment_total": 10. Se não houver, coloque 1 e 1.
Para o campo 'date', adivinhe o ano atual se não estiver explícito.
Categorias permitidas: moradia, alimentacao, transporte, saude, educacao, lazer, compras, assinaturas, outros.
Se não tiver certeza da categoria, use "outros".
Seja extremamente preciso com os valores financeiros.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keys.gemini}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1 // Temperatura baixa para ser preciso e não inventar dados
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na visão da IA: ${errText}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  
  // Limpar formatações de markdown caso ele retorne mesmo pedindo para não retornar
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Falha no parse do JSON retornado:', text);
    throw new Error('A IA não retornou os dados em um formato compreensível.');
  }
}

/**
 * Gera um resumo rápido para a tela inicial do Dashboard.
 */
export async function generateDashboardSummary(userId, month, year) {
  try {
    const keys = await getApiKeys(userId);
    if (!keys.gemini && !keys.groq) return "API Key do Gemini ou Groq não configurada. Vá em Configurações para habilitar a IA.";

    const expRes = await query(`
      SELECT SUM(e.amount) as total FROM expenses e
      JOIN invoices i ON e.invoice_id = i.id
      JOIN cards c ON i.card_id = c.id
      WHERE c.user_id = $1 AND i.month = $2 AND i.year = $3`, [userId, month, year]);
    
    const revRes = await query(`
      SELECT SUM(amount) as total FROM revenues 
      WHERE user_id = $1 AND EXTRACT(MONTH FROM received_date) = $2 AND EXTRACT(YEAR FROM received_date) = $3`, 
      [userId, month, year]);

    const spent = parseFloat(expRes.rows[0].total || 0);
    const revenue = parseFloat(revRes.rows[0].total || 0);
    const balance = revenue - spent;

    const baseContext = await getUserContext(userId);

    const prompt = `
      ${baseContext}
      Aqui estão os dados do mês ${month}/${year} do usuário até agora:
      - Entradas/Receitas: ${formatMoney(revenue)}
      - Saídas/Despesas: ${formatMoney(spent)}
      - Saldo (Entradas - Saídas): ${formatMoney(balance)}

      Escreva um parágrafo curto (máximo de 3 frases) em tom consultivo e amigável para exibir na tela principal do sistema financeiro (Dashboard) do usuário.
      Analise o saldo, e se o mês não for o atual, comente sobre o resultado. Se for o mês atual, dê uma dica ou incentivo baseando-se nas metas/orçamentos do perfil dele se houver. Use emojis sutilmente. Formate textos importantes em **negrito**.
    `;

    return await callGemini(keys.gemini, keys.groq, prompt);
  } catch (err) {
    console.error('Erro na IA Dashboard:', err);
    return "Não foi possível gerar a análise da IA no momento.";
  }
}
