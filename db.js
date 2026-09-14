const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      rank INTEGER NOT NULL DEFAULT 2 CHECK (rank BETWEEN 1 AND 12),
      software_role TEXT NOT NULL DEFAULT 'Mitglied' CHECK (software_role IN ('Mitglied','Administrator')),
      online BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('Xenon','Stance','Urlaub','Sanktion','Hausverbot')),
      member_name TEXT NOT NULL,
      license_plate TEXT,
      color TEXT,
      period TEXT,
      reason TEXT,
      fine NUMERIC(12,2),
      image_data TEXT,
      created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      date_value DATE NOT NULL,
      time_value TIME,
      location TEXT,
      description TEXT,
      created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS colors (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('Familie','Staatlich','Unternehmen')),
      group_name TEXT NOT NULL,
      primary_color TEXT,
      secondary_color TEXT,
      pearlescent TEXT,
      underbody TEXT,
      effect TEXT,
      info TEXT,
      updated_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_members_display_name ON members(display_name);
    CREATE INDEX IF NOT EXISTS idx_orders_member_name ON orders(member_name);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date_value);
    CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_colors_group_name ON colors(group_name);
  `);

  const admin = await query(`SELECT id FROM members WHERE username = 'admin' LIMIT 1`);
  if (!admin.rowCount) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'topgear', 12);
    await query(`
      INSERT INTO members (username, display_name, password_hash, rank, software_role, online)
      VALUES ('admin', 'Administrator', $1, 12, 'Administrator', false)
    `, [hash]);
    console.log('Default admin created: admin');
    if (!process.env.DEFAULT_ADMIN_PASSWORD) console.log('Default password: topgear (change it after first login)');
  }
}

module.exports = { pool, query, initDb };
