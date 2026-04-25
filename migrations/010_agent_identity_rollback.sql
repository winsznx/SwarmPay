-- 010 rollback — removes agent identity + payment intent audit columns
BEGIN;

DROP INDEX IF EXISTS idx_payment_intents_nonce_task;
DROP INDEX IF EXISTS idx_agents_wallet_address;

ALTER TABLE payment_intents
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS signature,
  DROP COLUMN IF EXISTS signer_address;

ALTER TABLE agents
  DROP COLUMN IF EXISTS wallet_address,
  DROP COLUMN IF EXISTS last_balance_usdc,
  DROP COLUMN IF EXISTS last_balance_synced_at,
  DROP COLUMN IF EXISTS erc8004_token_id,
  DROP COLUMN IF EXISTS erc8004_register_tx,
  DROP COLUMN IF EXISTS erc8004_bind_tx;

NOTIFY pgrst, 'reload schema';

COMMIT;
