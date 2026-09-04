import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('library playback migration', () => {
  const migration = readFileSync(
    join(__dirname, 'migrations', '20260904000000_add_library_playback_tracking', 'migration.sql'),
    'utf8',
  );

  it('adds real library events without reconstructing historical consumption', () => {
    expect(migration).toContain('CREATE TYPE "LibraryPlaybackStatus" AS ENUM');
    expect(migration).toContain('ADD VALUE \'LIBRARY_STARTED\'');
    expect(migration).toContain('ADD VALUE \'LIBRARY_COMPLETED\'');
    expect(migration).toContain('child_activity_event_source_type_consistent');
    const sqlWithoutComments = migration.replace(/--.*$/gm, '');
    expect(sqlWithoutComments).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });

  it('keeps one canonical session and one projection per playback event type', () => {
    expect(migration).toContain('"library_playback_client_session_id_key"');
    expect(migration).toContain('"child_activity_event_library_playback_id_type_key"');
    expect(migration).toContain('"child_activity_event_exactly_one_source"');
    expect(migration).toContain('"library_playback_completion_consistent"');
  });

  it('protects child ownership and catalog integrity with foreign keys', () => {
    expect(migration).toContain('FOREIGN KEY ("child_id") REFERENCES "child"("id")');
    expect(migration).toContain(
      'FOREIGN KEY ("library_content_id") REFERENCES "library_content"("id")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("library_playback_id", "child_id")',
    );
    expect(migration).toContain('REFERENCES "library_playback"("id", "child_id")');
  });
});
