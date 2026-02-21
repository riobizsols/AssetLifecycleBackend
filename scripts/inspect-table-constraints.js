#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

const table = process.argv[2];
if (!table) {
  console.error('Usage: node scripts/inspect-table-constraints.js <table_name>');
  process.exit(2);
}

(async () => {
  try {
    console.log(`Inspecting constraints for table: ${table}`);
    const res = await db.query(`
      SELECT
        c.conname AS constraint_name,
        c.contype AS constraint_type,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table_name,
        pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      LEFT JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = (
        SELECT oid FROM pg_class WHERE relname = $1
      )
      ORDER BY conname;
    `, [table]);

    if (res.rows.length === 0) {
      console.log('No constraints found or table does not exist.');
      process.exit(0);
    }

    for (const row of res.rows) {
      const type = row.constraint_type === 'p' ? 'PRIMARY KEY' : (row.constraint_type === 'f' ? 'FOREIGN KEY' : (row.constraint_type === 'u' ? 'UNIQUE' : 'OTHER'));
      console.log(`- ${row.constraint_name} (${type})`);
      if (row.column_name) console.log(`   Column: ${row.column_name}`);
      if (row.foreign_table_name) console.log(`   References: ${row.foreign_table_name}`);
      if (row.definition) console.log(`   Definition: ${row.definition}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error inspecting constraints:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
