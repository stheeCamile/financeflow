import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

import { query } from './db/connection.js';

async function run() {
  const res = await query(`SELECT value FROM settings WHERE key = 'gemini_api_key' LIMIT 1`);
  const apiKey = res.rows[0].value;
  
  const allSettings = await query(`SELECT * FROM settings`);
  console.log(allSettings.rows);
  process.exit(0);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run();
