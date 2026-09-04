import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const migrationDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;

function isLocalPostgresUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function withSchema(urlValue: string, schema: string): string {
  const url = new URL(urlValue);
  url.searchParams.set('schema', schema);
  return url.toString();
}

async function deployMigrations(url: string): Promise<void> {
  try {
    await execFileAsync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        join(__dirname, 'schema.prisma'),
      ],
      {
        cwd: join(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: url },
        maxBuffer: 2_000_000,
      },
    );
  } catch {
    throw new Error('local migration deploy failed');
  }
}

type MigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

const describeLocalPostgres = isLocalPostgresUrl(migrationDatabaseUrl)
  ? describe
  : describe.skip;

describeLocalPostgres('library playback migration chain', () => {
  let adminClient: PrismaClient | undefined;
  let testClient: PrismaClient | undefined;
  let schemaName: string;
  let schemaDatabaseUrl: string;

  beforeAll(async () => {
    schemaName = `migration_test_${process.pid}_${Date.now()}`;
    schemaDatabaseUrl = withSchema(migrationDatabaseUrl!, schemaName);
    adminClient = new PrismaClient({
      datasources: { db: { url: migrationDatabaseUrl! } },
    });
    await adminClient.$executeRawUnsafe(
      `CREATE SCHEMA ${quoteIdentifier(schemaName)}`,
    );
    testClient = new PrismaClient({
      datasources: { db: { url: schemaDatabaseUrl } },
    });
  });

  afterAll(async () => {
    await testClient?.$disconnect();
    if (adminClient) {
      await adminClient.$executeRawUnsafe(
        `DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`,
      );
      await adminClient.$disconnect();
    }
  });

  it('reproduces the original same-transaction enum-value failure', async () => {
    const transaction = testClient!.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'CREATE TYPE "ChildActivityType" AS ENUM (\'MISSION_COMPLETED\')',
      );
      await tx.$executeRawUnsafe(
        'ALTER TYPE "ChildActivityType" ADD VALUE \'LIBRARY_STARTED\'',
      );
      await tx.$executeRawUnsafe(
        'CREATE TABLE "enum_use_probe" ("type" "ChildActivityType" NOT NULL CHECK ("type" IN (\'LIBRARY_STARTED\')))',
      );
    });

    await expect(transaction).rejects.toThrow(
      /unsafe use|cannot.*transaction|enum/i,
    );
  });

  it('applies the complete migration chain in committed dependency order', async () => {
    await deployMigrations(schemaDatabaseUrl);

    const enumRows = await testClient!.$queryRawUnsafe<Array<{ label: string }>>(
      `
        SELECT e.enumlabel::text AS label
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'ChildActivityType'
          AND n.nspname = current_schema()
        ORDER BY e.enumsortorder
      `,
    );
    expect(enumRows.map((row) => row.label)).toEqual(
      expect.arrayContaining(['MISSION_COMPLETED', 'LIBRARY_STARTED', 'LIBRARY_COMPLETED']),
    );

    const tableRows = await testClient!.$queryRawUnsafe<Array<{ table_name: string }>>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'library_playback'
      `,
    );
    expect(tableRows).toHaveLength(1);

    const migrationRows = await testClient!.$queryRawUnsafe<MigrationRow[]>(
      `
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        WHERE migration_name IN (
          '20260904000000_add_library_playback_tracking',
          '20260904001000_add_library_playback_schema'
        )
        ORDER BY finished_at
      `,
    );
    expect(migrationRows).toHaveLength(2);
    expect(migrationRows.every((row) => row.finished_at !== null)).toBe(true);
    expect(migrationRows.every((row) => row.rolled_back_at === null)).toBe(true);
    expect(migrationRows[0].migration_name).toBe(
      '20260904000000_add_library_playback_tracking',
    );
    expect(migrationRows[1].migration_name).toBe(
      '20260904001000_add_library_playback_schema',
    );

    const constraints = await testClient!.$queryRawUnsafe<Array<{ conname: string }>>(
      `
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class r ON r.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = r.relnamespace
        WHERE n.nspname = current_schema()
          AND c.conname IN (
            'child_activity_event_exactly_one_source',
            'child_activity_event_source_type_consistent',
            'library_playback_completion_consistent'
          )
      `,
    );
    expect(constraints.map((constraint) => constraint.conname)).toEqual(
      expect.arrayContaining([
        'child_activity_event_exactly_one_source',
        'child_activity_event_source_type_consistent',
        'library_playback_completion_consistent',
      ]),
    );
  });
});
