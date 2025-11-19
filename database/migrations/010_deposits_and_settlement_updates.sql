-- Manual TON deposit tracking table and settlement metadata updates

CREATE TABLE IF NOT EXISTS manual_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  conversion_id UUID REFERENCES conversions(id) ON DELETE SET NULL,
  deposit_address VARCHAR(255) NOT NULL,
  expected_amount_ton NUMERIC(20, 8) NOT NULL,
  received_amount_ton NUMERIC(20, 8),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','awaiting_confirmation','confirmed','expired','failed')
  ),
  tx_hash VARCHAR(255),
  confirmations INT DEFAULT 0,
  min_confirmations INT DEFAULT 3,
  expires_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  last_checked_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_deposits_status ON manual_deposits(status);
CREATE INDEX IF NOT EXISTS idx_manual_deposits_address ON manual_deposits(deposit_address);
CREATE INDEX IF NOT EXISTS idx_manual_deposits_user ON manual_deposits(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_manual_deposits_updated_at'
  ) THEN
    CREATE TRIGGER update_manual_deposits_updated_at
    BEFORE UPDATE ON manual_deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(30) DEFAULT 'pending';

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES settlements(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversions_settlement_status'
  ) THEN
    ALTER TABLE conversions
      ADD CONSTRAINT chk_conversions_settlement_status
      CHECK (settlement_status IN ('pending','ready','processing','settled','failed'));
  END IF;
END $$;
