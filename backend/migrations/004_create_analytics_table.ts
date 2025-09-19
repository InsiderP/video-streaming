import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isPg = (knex.client.config.client as string).includes('pg');

  // Create analytics event enum (PG only)
  await knex.raw(`
    CREATE TYPE analytics_event AS ENUM ('play', 'pause', 'seek', 'quality_change', 'complete', 'abandon');
  `).catch(() => {});

  // Create video analytics table
  await knex.schema.createTable('video_analytics', (table) => {
    if (isPg) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    } else {
      table.string('id').primary();
      table.string('video_id').references('id').inTable('videos');
      table.string('user_id').references('id').inTable('users');
    }

    if (isPg) {
      table.specificType('event_type', 'analytics_event').notNullable();
    } else {
      table.string('event_type').notNullable();
    }

    table.timestamp('timestamp').defaultTo(knex.fn.now());
    table.integer('duration_watched'); // in seconds
    table.string('quality_watched', 20);
    table.string('device_type', 50);
    table.string('browser', 50);
    table.string('country', 2); // ISO country code

    if (isPg) {
      table.specificType('ip_address', 'inet');
    } else {
      table.string('ip_address', 45);
    }
    
    // Indexes
    table.index(['video_id']);
    table.index(['user_id']);
    table.index(['event_type']);
    table.index(['timestamp']);
    table.index(['video_id', 'timestamp']);
    table.index(['user_id', 'timestamp']);
  });

  // Create video likes table
  await knex.schema.createTable('video_likes', (table) => {
    if (isPg) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    } else {
      table.string('id').primary();
      table.string('video_id').references('id').inTable('videos');
      table.string('user_id').references('id').inTable('users');
    }

    table.boolean('is_like').notNullable(); // true for like, false for dislike
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['video_id']);
    table.index(['user_id']);
    table.unique(['video_id', 'user_id']);
  });

  // Create video comments table
  await knex.schema.createTable('video_comments', (table) => {
    if (isPg) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('parent_id').references('id').inTable('video_comments').onDelete('CASCADE');
    } else {
      table.string('id').primary();
      table.string('video_id').references('id').inTable('videos');
      table.string('user_id').references('id').inTable('users');
      table.string('parent_id').references('id').inTable('video_comments');
    }

    table.text('content').notNullable();
    table.boolean('is_edited').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['video_id']);
    table.index(['user_id']);
    table.index(['parent_id']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('video_comments');
  await knex.schema.dropTableIfExists('video_likes');
  await knex.schema.dropTableIfExists('video_analytics');
  await knex.raw('DROP TYPE IF EXISTS analytics_event').catch(() => {});
}
