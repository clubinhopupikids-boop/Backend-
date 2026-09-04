import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('mission activity and reward migration', () => {
  const migration = readFileSync(
    join(
      __dirname,
      'migrations',
      '20260902010000_add_child_activity_and_reward_ledger',
      'migration.sql',
    ),
    'utf8',
  );

  it('keeps event, currency and reason enums closed to the implemented product facts', () => {
    expect(migration).toContain(
      `CREATE TYPE "ChildActivityType" AS ENUM ('MISSION_COMPLETED')`,
    );
    expect(migration).toContain(`CREATE TYPE "RewardCurrency" AS ENUM ('STAR', 'CRYSTAL')`);
    expect(migration).toContain(
      `CREATE TYPE "RewardReason" AS ENUM ('MISSION_COMPLETED')`,
    );
  });

  it('enforces event and reward idempotency structurally', () => {
    expect(migration).toContain(
      '"child_activity_event_mission_completion_id_child_id_key"',
    );
    expect(migration).toContain(
      '"reward_transaction_mission_completion_id_currency_key"',
    );
    expect(migration).toContain('"reward_transaction_idempotency_key_key"');
  });

  it('enforces non-zero signed ledger amounts and child-owned canonical origins', () => {
    expect(migration).toContain('CHECK ("amount" <> 0)');
    expect(migration).toContain(
      'FOREIGN KEY ("mission_completion_id", "child_id")',
    );
    expect(migration).toContain('REFERENCES "mission_completion"("id", "child_id")');
  });

  it('creates the temporal indexes used by future 7 day, 30 day and 3 month queries', () => {
    expect(migration).toContain('"mission_completion_child_id_completed_at_idx"');
    expect(migration).toContain('"child_activity_event_child_id_occurred_at_idx"');
    expect(migration).toContain('"child_activity_event_child_id_type_occurred_at_idx"');
  });
});
