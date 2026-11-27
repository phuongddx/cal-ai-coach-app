-- Throwaway spike schema (spec D4). Applied by scripts/start-api.sh on the real
-- PostgreSQL 17 cluster and by the Jest tests on PGlite — the same SQL both ways.
--
-- Timestamps: the LWW clock is `updated_at` / `client_timestamp` (integer ms from
-- the client wall clock). `eaten_at` is an ISO-8601 string passthrough: the
-- server never compares it, so text keeps the wire round-trip exact.

CREATE TABLE IF NOT EXISTS meals (
  user_id uuid NOT NULL,
  id uuid NOT NULL,
  eaten_at text NOT NULL,
  name text NOT NULL,
  kcal double precision NOT NULL,
  protein_g double precision NOT NULL,
  carbs_g double precision NOT NULL,
  fat_g double precision NOT NULL,
  fiber_g double precision NOT NULL,
  updated_at bigint NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  server_version integer NOT NULL DEFAULT 1,
  accepted_op_id uuid,
  PRIMARY KEY (user_id, id)
);

-- The idempotency ledger: `op_id` is unique per user. A seen op answers
-- `duplicate` with the current record and writes nothing.
CREATE TABLE IF NOT EXISTS sync_ops (
  user_id uuid NOT NULL,
  op_id uuid NOT NULL,
  record_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('upsert', 'tombstone')),
  client_timestamp bigint NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, op_id)
);

-- The pull log. `seq` is the cursor clients pull with.
CREATE TABLE IF NOT EXISTS sync_changes (
  seq bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  record_id uuid NOT NULL,
  record jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS sync_changes_user_seq_idx ON sync_changes (user_id, seq);
