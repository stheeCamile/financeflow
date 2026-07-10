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
    // Try to drop by names that might have been generated
    const res = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'cards'::regclass AND contype = 'c';
    `);
    
    for (const row of res.rows) {
      if (row.conname.includes('type') || row.conname.includes('cards_type_check')) {
        console.log('Dropping constraint:', row.conname);
        await client.query(`ALTER TABLE cards DROP CONSTRAINT "${row.conname}"`);
      }
    }

    await client.query("ALTER TABLE cards ADD CONSTRAINT cards_type_check CHECK (type IN ('credit', 'debit', 'account'))");
    console.log('Migration DB pix/account added successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}
run();
