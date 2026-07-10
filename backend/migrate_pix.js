import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Acha o nome da constraint do tipo
    const res = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'cards'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%type %';
    `);
    
    for (const row of res.rows) {
      console.log('Dropping constraint:', row.conname);
      await client.query(`ALTER TABLE cards DROP CONSTRAINT "${row.conname}"`);
    }

    await client.query("ALTER TABLE cards ADD CONSTRAINT cards_type_check CHECK (type IN ('credit', 'debit', 'account'))");
    console.log('Migration DB pix/account added successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}
run();
