/**
 * Script one-time: vincula o @lid do WhatsApp Business ao usuário pelo número de telefone salvo
 * Uso: node link_lid.js <lid> <phone>
 * Exemplo: node link_lid.js 169586867589375 5541998703460
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const lid   = process.argv[2];
const phone = process.argv[3];

if (!lid || !phone) {
  console.error('Uso: node link_lid.js <lid> <phone>');
  process.exit(1);
}

async function run() {
  const client = await pool.connect();
  try {
    // Busca o user_id pelo número de telefone
    const userRes = await client.query(
      `SELECT user_id FROM settings WHERE key = 'whatsapp_number' AND value = $1`,
      [phone]
    );

    if (userRes.rows.length === 0) {
      console.error(`❌ Nenhum usuário encontrado com o número: ${phone}`);
      process.exit(1);
    }

    const userId = userRes.rows[0].user_id;
    console.log(`✅ Usuário encontrado (user_id: ${userId})`);

    // Salva o @lid
    await client.query(
      `INSERT INTO settings (key, value, user_id) VALUES ('whatsapp_lid', $1, $2)
       ON CONFLICT (key, user_id) DO UPDATE SET value = $1, updated_at = NOW()`,
      [lid, userId]
    );

    console.log(`✅ @lid "${lid}" vinculado ao usuário ${userId} com sucesso!`);
    console.log(`\n🎉 Agora mande qualquer mensagem para o bot — deve funcionar!`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('Erro:', err.message); process.exit(1); });
