import knex, { Knex } from 'knex';
import { config } from './environment';

// Use SQLite ONLY if explicitly requested via DB_CLIENT=sqlite3
const useSQLite = process.env.DB_CLIENT === 'sqlite3';

const knexConfig: Knex.Config = useSQLite ? {
  client: 'sqlite3',
  connection: {
    filename: process.env.DB_CONNECTION || './database.sqlite',
  },
  useNullAsDefault: true,
} : {
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
  debug: config.nodeEnv === 'development',
};

export const db = knex(knexConfig);

export default db;
