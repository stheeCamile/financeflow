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
    await client.query("ALTER TABLE cards ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'credit' CHECK (type IN ('credit', 'debit'))");
    await client.query("ALTER TABLE cards ALTER COLUMN closing_day DROP NOT NULL");
    await client.query("ALTER TABLE cards ALTER COLUMN due_day DROP NOT NULL");
    console.log('Migration DB type added successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}
run();
