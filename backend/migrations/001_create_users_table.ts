import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure pgcrypto is available for gen_random_uuid()
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"').catch(() => {});

  // Create user roles enum (Postgres only)
  await knex.raw(`
    CREATE TYPE user_role AS ENUM ('admin', 'creator', 'viewer');
  `).catch(() => {});

  // Create subscription tiers enum (Postgres only)
  await knex.raw(`
    CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'pro');
  `).catch(() => {});

  // Create users table
  await knex.schema.createTable('users', (table) => {
    // UUID default (fallback to text if not Postgres)
    if ((knex.client.config.client as string).includes('pg')) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    } else {
      table.string('id').primary();
    }
    table.string('email', 255).unique().notNullable();
    table.string('username', 100).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100);
    table.string('last_name', 100);
    table.string('avatar_url', 500);

    if ((knex.client.config.client as string).includes('pg')) {
      table.specificType('role', 'user_role').defaultTo('viewer');
      table.specificType('subscription_tier', 'subscription_tier').defaultTo('free');
    } else {
      table.string('role').defaultTo('viewer');
      table.string('subscription_tier').defaultTo('free');
    }

    table.boolean('is_active').defaultTo(true);
    table.boolean('email_verified').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['email']);
    table.index(['username']);
    table.index(['is_active']);
  });

  // Create user sessions table
  await knex.schema.createTable('user_sessions', (table) => {
    if ((knex.client.config.client as string).includes('pg')) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    } else {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users');
    }

    table.string('session_token', 500).unique().notNullable();
    table.timestamp('expires_at').notNullable();

    if ((knex.client.config.client as string).includes('pg')) {
      table.specificType('ip_address', 'inet');
    } else {
      table.string('ip_address', 45);
    }

    table.text('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['session_token']);
    table.index(['expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_sessions');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS subscription_tier').catch(() => {});
  await knex.raw('DROP TYPE IF EXISTS user_role').catch(() => {});
}
