/**
 * Parser de mensagens WhatsApp em linguagem natural
 * Interpreta mensagens como:
 *   "gastei 150 com mercado no nubank"
 *   "paguei 89,90 de gasolina no itau em 3x"
 *   "recebi 3000 salário"
 */

// Mapeamento de palavras-chave para categorias
const CATEGORY_KEYWORDS = {
  alimentacao: ['mercado', 'supermercado', 'ifood', 'rappi', 'uber eats', 'restaurante', 'lanche', 'pizza', 'hamburguer', 'comida', 'alimento', 'feira', 'padaria', 'açougue', 'sushi', 'delivery'],
  transporte: ['gasolina', 'combustivel', 'uber', '99', 'taxi', 'onibus', 'metro', 'estacionamento', 'pedagio', 'carro', 'posto', 'combustível', 'passagem', 'corrida'],
  saude: ['farmacia', 'remedio', 'médico', 'medico', 'consulta', 'hospital', 'clinica', 'exame', 'dentista', 'academia', 'gym', 'plano de saude'],
  lazer: ['netflix', 'spotify', 'cinema', 'teatro', 'show', 'ingresso', 'jogo', 'viagem', 'hotel', 'airbnb', 'diversão', 'bar', 'balada', 'clube'],
  educacao: ['curso', 'faculdade', 'escola', 'livro', 'udemy', 'alura', 'udemy', 'material escolar', 'mensalidade'],
  casa: ['aluguel', 'condominio', 'luz', 'agua', 'gas', 'internet', 'conta de', 'energia', 'limpeza', 'mobilia', 'eletrodomestico'],
  roupas: ['roupa', 'sapato', 'calçado', 'calcado', 'camisa', 'calça', 'vestido', 'tenis', 'tênis', 'lojas', 'renner', 'riachuelo', 'c&a', 'zara'],
  outros: [],
};

// Mapeamento de nomes de cartões (flexível)
const CARD_NAME_KEYWORDS = {
  nubank: ['nubank', 'nu', 'roxinho'],
  itau: ['itau', 'itaú'],
  bradesco: ['bradesco'],
  santander: ['santander'],
  caixa: ['caixa', 'cef'],
  'banco do brasil': ['bb', 'banco do brasil', 'ourocard'],
  inter: ['inter', 'banco inter'],
  c6: ['c6', 'c6 bank'],
  xp: ['xp', 'xp investimentos'],
  next: ['next'],
};

function normalizeText(text) {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s,\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(text) {
  // Aceita: 150, 150.00, 150,00, R$150, R$ 150,90
  const match = text.match(/r?\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}

function detectCategory(text) {
  const normalized = normalizeText(text);
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'outros') continue;
    if (keywords.some(kw => normalized.includes(kw))) return category;
  }
  return 'outros';
}

function detectCardName(text) {
  const normalized = normalizeText(text);
  for (const [card, keywords] of Object.entries(CARD_NAME_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw))) return card;
  }
  return null;
}

function detectInstallments(text) {
  const normalized = normalizeText(text);
  // "em 3x", "3 vezes", "3 parcelas"
  const match = normalized.match(/(?:em\s+)?(\d+)\s*(?:x|vezes|parcelas?)/i);
  if (match) return parseInt(match[1]);
  return 1;
}

/**
 * Analisa uma mensagem e retorna os dados interpretados
 * @param {string} message - Mensagem do WhatsApp
 * @returns {{ type: 'expense'|'revenue'|'unknown', data: object, raw: string }}
 */
export function parseMessage(message) {
  const raw = message.trim();
  const normalized = normalizeText(raw);

  // Detectar se é receita
  const isRevenue = /(?:recebi|ganhei|entrou|recebimento|salario|salário|freela|freelance)/.test(normalized);

  if (isRevenue) {
    const amount = parseAmount(normalized);
    if (!amount) return { type: 'unknown', raw };

    let category = 'outros';
    if (/salario|salário/.test(normalized)) category = 'salario';
    else if (/freela|freelance/.test(normalized)) category = 'freelance';
    else if (/aluguel/.test(normalized)) category = 'aluguel';

    // Extrair descrição (tudo após "recebi X")
    const descMatch = raw.match(/(?:recebi|ganhei)\s+[\d.,R$\s]+(?:de\s+)?(.+)/i);
    const description = descMatch ? descMatch[1].trim() : 'Receita';

    return {
      type: 'revenue',
      data: { amount, category, description },
      raw,
    };
  }

  // Detectar gasto
  const isExpense = /(?:gastei|paguei|comprei|gasto|compra)/.test(normalized);
  if (!isExpense) return { type: 'unknown', raw };

  const amount = parseAmount(normalized);
  if (!amount) return { type: 'unknown', raw };

  const cardName = detectCardName(normalized);
  const installments = detectInstallments(normalized);

  // Extrair descrição: tudo entre o valor e o nome do cartão
  let description = 'Compra';
  // Tenta capturar "gastei X com/de DESCRIÇÃO no CARTÃO"
  const descMatch = raw.match(/(?:gastei|paguei|comprei)\s+[\d.,R$\s]+\s+(?:com|de|em|no|na)?\s*(.+?)(?:\s+n[ao]\s+\w+)?(?:\s+em\s+\d+x)?$/i);
  if (descMatch) {
    let desc = descMatch[1];
    // Remove nome do cartão da descrição
    if (cardName) {
      const cardKeywords = CARD_NAME_KEYWORDS[cardName] || [];
      cardKeywords.forEach(kw => {
        desc = desc.replace(new RegExp(kw, 'gi'), '').trim();
      });
    }
    // Remove conectivos e sujeiras do final e do meio
    desc = desc.replace(/\b(?:no cart[aã]o|no cr[eé]dito|no d[eé]bito|cart[aã]o de cr[eé]dito|cart[aã]o de d[eé]bito|no pix|no dinheiro|no|na)\b/gi, '').trim();
    desc = desc.replace(/\s+/g, ' ').trim();
    if (desc.length > 1) description = desc;
  }

  const category = detectCategory(normalized);

  return {
    type: 'expense',
    data: {
      amount,
      description: description.length > 1 ? description : 'Compra',
      category,
      card_name: cardName,
      installment_total: installments,
      purchase_date: new Date().toISOString().split('T')[0],
    },
    raw,
  };
}

export default { parseMessage };
