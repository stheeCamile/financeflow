import { query } from './src/db/connection.js';

async function run() {
  try {
    console.log('Adding balance to cards...');
    await query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS balance DECIMAL(12,2) DEFAULT 0;`);
    
    console.log('Adding account_id to revenues...');
    await query(`ALTER TABLE revenues ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES cards(id) ON DELETE SET NULL;`);
    
    console.log('Migration Phase 4 completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
