require('dotenv').config();

const isSQLite = process.env.DB_CLIENT === 'sqlite3' || (!process.env.DB_HOST && process.env.DB_CONNECTION);

const base = {
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
  },
  debug: process.env.NODE_ENV === 'development',
};

const sqlite = {
  client: 'sqlite3',
  connection: {
    filename: process.env.DB_CONNECTION || './database.sqlite',
  },
  useNullAsDefault: true,
  ...base,
};

const pg = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'video_streaming',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 2,
    max: 10,
  },
  ...base,
};

module.exports = isSQLite ? sqlite : pg;
