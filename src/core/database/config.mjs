export function getEnv(name, fallback = undefined) {
  return process.env[name] ?? fallback;
}

export function getDbConfig() {
  return {
    enabled: String(getEnv('PG_ENABLED', 'false')).toLowerCase() === 'true',
    host: getEnv('PGHOST', '127.0.0.1'),
    port: Number(getEnv('PGPORT', '5432')),
    database: getEnv('PGDATABASE', 'laboratorio_catalog'),
    user: getEnv('PGUSER', 'postgres'),
    password: getEnv('PGPASSWORD', 'postgres'),
  };
}
