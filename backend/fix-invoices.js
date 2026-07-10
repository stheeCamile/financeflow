import { query } from './src/db/connection.js';

async function fixInvoices() {
  try {
    const result = await query(`
      UPDATE invoices
      SET status = 'paid'
      WHERE card_id IN (
        SELECT id FROM cards WHERE type IN ('debit', 'account')
      ) AND status = 'open'
    `);
    console.log(`Fixed ${result.rowCount} debit/account invoices.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixInvoices();
