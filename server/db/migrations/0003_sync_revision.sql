-- A counter that goes up with every upload, so a device can tell whether the server changed
-- since it last synced and an upload based on old data can be refused.
BEGIN;
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
COMMIT;
