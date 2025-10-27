import { Pool, type PoolClient } from 'pg';
import type { QueryResult } from 'pg';
import config from '../config/index.js';

let pool: Pool;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
};

export const getClient = async (): Promise<PoolClient> => {
  const pool = getPool();
  return await pool.connect();
};

export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`Executed query in ${duration}ms: ${text.substring(0, 50)}...`);
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    console.log('Database pool closed');
  }
};

