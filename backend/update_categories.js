import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:YxDaL0Zjmv5LksqV@db.wtdqxdoeilgjozdvrjrp.supabase.co:5432/postgres' });

async function run() {
  const { rows } = await pool.query("SELECT id FROM users WHERE email = 'sthetec10@gmail.com'");
  if (rows.length === 0) { console.log('User not found'); return; }
  const userId = rows[0].id;

  const cardRes = await pool.query("SELECT id FROM cards WHERE user_id = $1", [userId]);
  if (cardRes.rows.length === 0) return;
  const cardIds = cardRes.rows.map(c => c.id);

  const expenses = await pool.query("SELECT id, description FROM expenses WHERE card_id = ANY($1)", [cardIds]);

  let updated = 0;
  for (const exp of expenses.rows) {
    const desc = exp.description.toLowerCase();
    let newCategory = 'outros';

    if (desc.includes('juros') || desc.includes('iof') || desc.includes('multa') || desc.includes('encargo')) {
      newCategory = 'juros';
    } else if (desc.includes('uber') || desc.includes('99') || desc.includes('cabify') || desc.includes('posto') || desc.includes('combustivel')) {
      newCategory = 'transporte';
    } else if (desc.includes('ifood') || desc.includes('food') || desc.includes('mcdonald') || desc.includes('burger') || desc.includes('supermercado') || desc.includes('padaria') || desc.includes('market') || desc.includes('restaurante')) {
      newCategory = 'alimentacao';
    } else if (desc.includes('amazon prime') || desc.includes('netflix') || desc.includes('spotify') || desc.includes('youtube') || desc.includes('disney') || desc.includes('hbo')) {
      newCategory = 'assinaturas';
    } else if (desc.includes('farmacia') || desc.includes('droga') || desc.includes('dental') || desc.includes('medico') || desc.includes('hospital')) {
      newCategory = 'saude';
    }

    if (newCategory !== 'outros') {
      await pool.query("UPDATE expenses SET category = $1 WHERE id = $2", [newCategory, exp.id]);
      updated++;
    }
  }

  console.log(`Updated ${updated} expenses!`);
  process.exit(0);
}

run().catch(console.error);
