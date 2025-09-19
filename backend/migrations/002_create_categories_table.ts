import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create categories table
  await knex.schema.createTable('categories', (table) => {
    if ((knex.client.config.client as string).includes('pg')) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('parent_id').references('id').inTable('categories');
    } else {
      table.string('id').primary();
      table.string('parent_id').references('id').inTable('categories');
    }

    table.string('name', 100).unique().notNullable();
    table.text('description');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['name']);
    table.index(['parent_id']);
  });

  // Insert default categories
  await knex('categories').insert([
    { name: 'Entertainment', description: 'Entertainment videos' },
    { name: 'Education', description: 'Educational content' },
    { name: 'Technology', description: 'Technology related videos' },
    { name: 'Sports', description: 'Sports content' },
    { name: 'Music', description: 'Music videos and performances' },
    { name: 'Gaming', description: 'Gaming content' },
    { name: 'News', description: 'News and current events' },
    { name: 'Lifestyle', description: 'Lifestyle and vlogs' },
  ]).catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('categories');
}
