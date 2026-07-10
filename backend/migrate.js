/**
 * Script de migração — executa os SQLs no banco configurado no .env
 * Uso: node migrate.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('🔌 Conectando ao banco de dados...');
  const client = await pool.connect();

  try {
    console.log('✅ Conectado!');

    const migrations = [
      { name: 'Schema principal',   file: join(__dirname, 'src/db/migrations.sql') },
      { name: 'Autenticação',       file: join(__dirname, 'src/db/migration_auth.sql') },
    ];

    for (const m of migrations) {
      console.log(`\n▶  Executando: ${m.name}...`);
      const sql = readFileSync(m.file, 'utf8');
      await client.query(sql);
      console.log(`✅ ${m.name} — concluído!`);
    }

    console.log('\n🎉 Todas as migrações foram executadas com sucesso!');
    console.log('▶  Agora você pode iniciar o backend com: npm run dev');
  } catch (err) {
    console.error('\n❌ Erro durante a migração:', err.message);
    console.error('\nDetalhes:', err.detail || '');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
