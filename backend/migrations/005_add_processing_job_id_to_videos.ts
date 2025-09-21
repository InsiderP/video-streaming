import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.string('processing_job_id').nullable().comment('AWS MediaConvert job ID for tracking processing status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('videos', (table) => {
    table.dropColumn('processing_job_id');
  });
}
