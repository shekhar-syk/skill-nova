import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

let pgPool = null;
let sqliteDb = null;

export const isPostgres = Boolean(
  config.databaseUrl &&
  config.databaseUrl.trim().length > 0 &&
  !config.databaseUrl.includes('USER:PASSWORD@HOST')
);

if (config.isProduction && !isPostgres) {
  throw new Error('PostgreSQL DATABASE_URL is mandatory in production. SQLite fallback is disabled.');
}

function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    pgPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err.message);
    });
  }
  return pgPool;
}

function getSqliteDbPath() {
  const dataDir = path.resolve(process.cwd(), 'backend', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return process.env.SQLITE_DB_PATH || path.join(dataDir, 'skillnova.db');
}

export function resetLocalSqliteDb() {
  if (config.isProduction || isPostgres) {
    return false;
  }
  if (sqliteDb) {
    try {
      sqliteDb.close();
    } catch {
      // ignore close errors on damaged handle
    }
    sqliteDb = null;
  }
  const dbFile = getSqliteDbPath();
  for (const candidate of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
    }
  }
  return true;
}

function openFreshSqliteDb(dbFile) {
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = DELETE;');
  db.exec('PRAGMA synchronous = NORMAL;');
  return db;
}

function getSqliteDb() {
  if (config.isProduction) {
    throw new Error('SQLite fallback is strictly forbidden in production.');
  }
  if (!sqliteDb) {
    const dbFile = getSqliteDbPath();
    try {
      const db = openFreshSqliteDb(dbFile);
      const integrity = db.prepare('PRAGMA quick_check(1);').get();
      const status = integrity?.quick_check;
      if (status && status !== 'ok') {
        throw new Error(`SQLite integrity check failed: ${status}`);
      }
      sqliteDb = db;
    } catch (err) {
      console.warn('[SKILLNOVA DB] Local SQLite file was malformed or locked; recreating clean dev database:', err.message);
      resetLocalSqliteDb();
      sqliteDb = openFreshSqliteDb(dbFile);
    }
  }
  return sqliteDb;
}

/**
 * Converts Postgres-style $1, $2 parameters to SQLite ? placeholders,
 * expanding repeated parameter references in order.
 */
function adaptSqlForSqlite(sql, params = []) {
  const expandedParams = [];
  const adaptedSql = sql.replace(/\$(\d+)/g, (_, indexStr) => {
    const idx = Number(indexStr) - 1;
    let val = params[idx];
    if (typeof val === 'boolean') val = val ? 1 : 0;
    if (val instanceof Date) val = val.toISOString();
    expandedParams.push(val === undefined ? null : val);
    return '?';
  });
  return { adaptedSql, expandedParams };
}

export async function query(sql, params = []) {
  if (isPostgres) {
    const pool = getPgPool();
    const result = await pool.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount };
  }

  const db = getSqliteDb();
  const { adaptedSql, expandedParams } = adaptSqlForSqlite(sql, params);
  const trimmed = adaptedSql.trim().toUpperCase();
  const hasReturning = /\bRETURNING\b/i.test(adaptedSql);

  const stmt = db.prepare(adaptedSql);
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA') || hasReturning) {
    const rows = stmt.all(...expandedParams);
    return { rows, rowCount: rows.length };
  }
  const info = stmt.run(...expandedParams);
  return {
    rows: [],
    rowCount: Number(info.changes || 0),
    lastInsertRowid: Number(info.lastInsertRowid || 0),
  };
}

export async function queryOne(sql, params = []) {
  const res = await query(sql, params);
  return res.rows[0] || null;
}

export async function execRaw(sql) {
  if (isPostgres) {
    const pool = getPgPool();
    await pool.query(sql);
    return;
  }
  const db = getSqliteDb();
  db.exec(sql);
}

export async function ensureColumn(tableName, columnName, pgDef, sqliteDef) {
  if (isPostgres) {
    await execRaw(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${pgDef};`);
    return;
  }
  const db = getSqliteDb();
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = cols.some((c) => c.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqliteDef};`);
  }
}

export async function withTransaction(fn) {
  if (isPostgres) {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        query: async (sql, params = []) => {
          const r = await client.query(sql, params);
          return { rows: r.rows, rowCount: r.rowCount };
        },
        queryOne: async (sql, params = []) => {
          const r = await client.query(sql, params);
          return r.rows[0] || null;
        },
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const db = getSqliteDb();
  db.exec('BEGIN');
  try {
    const result = await fn({ query, queryOne });
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export async function checkDatabaseHealth() {
  try {
    await query('SELECT 1 AS ok');
    return { connected: true, engine: isPostgres ? 'postgresql' : 'sqlite-dev' };
  } catch (err) {
    return { connected: false, engine: isPostgres ? 'postgresql' : 'sqlite-dev', error: err.message };
  }
}
