/**
 * Jest twin of native/Modules/CoachCalPersistence/Tests/CoachCalPersistenceTests/DomainMigrationTests.swift —
 * one case per Swift test, the same behavior sentences. The Swift registry
 * identifiers (1__foundation_sync / 2__outbox_dead_letter / 3__domain_core)
 * are carried by the single clean generated migration here (brief U-12:
 * "start from a clean migration history: the first generated migration
 * creates the 15 tables"); the test asserts that shape instead of a
 * grdb_migrations table.
 */
import { MIGRATIONS } from './migrations';
import { appliedMigrationCount, applyMigrationsSqlJs } from './testing/sqlJsDb';
import { columnNames, createRepoFixture, tableNames } from '../repos/testing/fixtures';

const DOMAIN_TABLES = [
  'user_targets', 'diary_entry_details', 'foods', 'saved_meals', 'custom_foods',
  'water_logs', 'weight_logs', 'exercise_logs', 'streak_state', 'badges',
  'insights', 'app_settings',
];

const SWIFT_MIGRATION_IDENTIFIERS = ['1__foundation_sync', '2__outbox_dead_letter', '3__domain_core'];

describe('DomainMigrationTests twins', () => {
  it('domain core registers in the migration registry', async () => {
    const fixture = await createRepoFixture();

    // The single clean migration carries every Swift migration's content,
    // under the ordered id the bundle generated for it.
    expect(MIGRATIONS.map((migration) => migration.id)).toEqual(['0000']);
    const bundledSql = MIGRATIONS.flatMap((migration) => migration.sql).join('\n');
    for (const table of ['diary_entries', 'pending_ops', 'sync_state', ...DOMAIN_TABLES]) {
      expect(bundledSql).toContain(`CREATE TABLE \`${table}\``);
    }
    // The dead-letter alter of the Swift second migration is inlined as the
    // last pending_ops column.
    expect(columnNames(fixture.client, 'pending_ops')).toContain('quarantined');
    expect(SWIFT_MIGRATION_IDENTIFIERS).toHaveLength(3); // documented GRDB history
  });

  it('domain core creates all domain tables', async () => {
    const fixture = await createRepoFixture();

    const names = tableNames(fixture.client);
    for (const table of DOMAIN_TABLES) {
      expect(names).toContain(table);
    }
  });

  it('diary entry details has the exact column list', async () => {
    const fixture = await createRepoFixture();

    expect(columnNames(fixture.client, 'diary_entry_details')).toEqual([
      'entry_id', 'meal_slot', 'title', 'grams', 'kcal', 'protein_g',
      'carbs_g', 'fat_g', 'fiber_g', 'confidence', 'hidden_fat_likely',
      'source', 'unresolved', 'scan_id',
    ]);
  });

  it('user targets has the exact column list', async () => {
    const fixture = await createRepoFixture();

    expect(columnNames(fixture.client, 'user_targets')).toEqual([
      'id', 'user_id', 'daily_kcal', 'protein_g', 'carbs_g', 'fat_g',
      'fiber_goal_g', 'water_glasses', 'sex', 'height_cm', 'weight_kg',
      'goal_weight_kg', 'pace_kg_per_week', 'activity', 'goal', 'updated_at',
    ]);
  });

  it('domain tables carry no server sync columns', async () => {
    const fixture = await createRepoFixture();

    const syncColumns = ['server_version', 'accepted_op_id', 'server_updated_at'];
    for (const table of DOMAIN_TABLES) {
      const leaked = columnNames(fixture.client, table).filter((column) => syncColumns.includes(column));
      expect(leaked).toEqual([]);
    }
  });

  it('domain core is idempotent', async () => {
    const fixture = await createRepoFixture();

    await applyMigrationsSqlJs(fixture.client, MIGRATIONS);
    await applyMigrationsSqlJs(fixture.client, MIGRATIONS);

    expect(await appliedMigrationCount(fixture.client)).toBe(MIGRATIONS.length);
    expect(columnNames(fixture.client, 'diary_entries')).toEqual([
      'id', 'user_id', 'display_text', 'created_at', 'updated_at',
      'deleted_at', 'server_version', 'accepted_op_id', 'server_updated_at',
    ]);
  });
});
