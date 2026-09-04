import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('library playback migration', () => {
  const enumMigration = readFileSync(
    join(__dirname, 'migrations', '20260904000000_add_library_playback_tracking', 'migration.sql'),
    'utf8',
  );
  const schemaMigration = readFileSync(
    join(__dirname, 'migrations', '20260904001000_add_library_playback_schema', 'migration.sql'),
    'utf8',
  );

  it('commits the activity enum values without using them in the same migration', () => {
    expect(enumMigration).toContain('ADD VALUE \'LIBRARY_STARTED\'');
    expect(enumMigration).toContain('ADD VALUE \'LIBRARY_COMPLETED\'');
    expect(enumMigration).not.toContain('CREATE TABLE "library_playback"');
    expect(enumMigration).not.toContain('child_activity_event_source_type_consistent');
    expect(enumMigration.replace(/--.*$/gm, '')).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it('creates the canonical playback schema after the enum migration', () => {
    expect(schemaMigration).toContain('CREATE TYPE "LibraryPlaybackStatus" AS ENUM');
    expect(schemaMigration).not.toContain('ADD VALUE \'LIBRARY_STARTED\'');
    expect(schemaMigration).not.toContain('ADD VALUE \'LIBRARY_COMPLETED\'');
    expect(schemaMigration).toContain('"library_playback_client_session_id_key"');
    expect(schemaMigration).toContain('"child_activity_event_library_playback_id_type_key"');
    expect(schemaMigration).toContain('"child_activity_event_exactly_one_source"');
    expect(schemaMigration).toContain('"child_activity_event_source_type_consistent"');
    expect(schemaMigration).toContain('"library_playback_completion_consistent"');
  });

  it('protects child ownership and catalog integrity with foreign keys', () => {
    expect(schemaMigration).toContain('FOREIGN KEY ("child_id") REFERENCES "child"("id")');
    expect(schemaMigration).toContain(
      'FOREIGN KEY ("library_content_id") REFERENCES "library_content"("id")',
    );
    expect(schemaMigration).toContain(
      'FOREIGN KEY ("library_playback_id", "child_id")',
    );
    expect(schemaMigration).toContain('REFERENCES "library_playback"("id", "child_id")');
  });
});
