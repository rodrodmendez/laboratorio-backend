import { getDbConfig } from './config.mjs';

let cachedPool = null;

export async function getPgPool() {
  const config = getDbConfig();
  if (!config.enabled) return null;
  if (cachedPool) return cachedPool;

  let pgModule;
  try {
    pgModule = await import('pg');
  } catch (error) {
    throw new Error('PG_ENABLED=true pero el paquete pg no esta instalado.');
  }

  const { Pool } = pgModule;
  cachedPool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });

  return cachedPool;
}

export async function query(text, params = []) {
  const pool = await getPgPool();
  if (!pool) return null;
  return pool.query(text, params);
}
