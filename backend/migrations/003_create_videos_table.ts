import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create video status enum (PG only)
  await knex.raw(`
    CREATE TYPE video_status AS ENUM ('uploading', 'processing', 'ready', 'failed', 'deleted');
  `).catch(() => {});

  // Create visibility type enum (PG only)
  await knex.raw(`
    CREATE TYPE visibility_type AS ENUM ('public', 'private', 'unlisted');
  `).catch(() => {});

  const isPg = (knex.client.config.client as string).includes('pg');

  // Create videos table
  await knex.schema.createTable('videos', (table) => {
    if (isPg) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('category_id').references('id').inTable('categories');
    } else {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users');
      table.string('category_id').references('id').inTable('categories');
    }

    table.string('title', 255).notNullable();
    table.text('description');
    table.string('original_filename', 255);
    table.bigInteger('file_size');
    table.integer('duration'); // in seconds
    table.string('thumbnail_url', 500);

    if (isPg) {
      table.specificType('status', 'video_status').defaultTo('processing');
      table.specificType('visibility', 'visibility_type').defaultTo('private');
      table.specificType('tags', 'text[]');
    } else {
      table.string('status').defaultTo('processing');
      table.string('visibility').defaultTo('private');
      table.text('tags');
    }

    table.integer('view_count').defaultTo(0);
    table.integer('like_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id']);
    table.index(['status']);
    table.index(['visibility']);
    table.index(['category_id']);
    table.index(['created_at']);
    table.index(['view_count']);
    table.index(['like_count']);
  });

  // Create video variants table (for adaptive bitrate)
  await knex.schema.createTable('video_variants', (table) => {
    if (isPg) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('video_id').references('id').inTable('videos').onDelete('CASCADE');
    } else {
      table.string('id').primary();
      table.string('video_id').references('id').inTable('videos');
    }

    table.string('quality', 20).notNullable(); // '1080p', '720p', etc.
    table.integer('bitrate').notNullable(); // in kbps
    table.integer('resolution_width').notNullable();
    table.integer('resolution_height').notNullable();
    table.string('file_path', 500).notNullable();
    table.bigInteger('file_size');
    table.string('hls_playlist_url', 500);
    table.string('dash_manifest_url', 500);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['video_id']);
    table.index(['quality']);
    table.unique(['video_id', 'quality']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('video_variants');
  await knex.schema.dropTableIfExists('videos');
  await knex.raw('DROP TYPE IF EXISTS visibility_type').catch(() => {});
  await knex.raw('DROP TYPE IF EXISTS video_status').catch(() => {});
}
