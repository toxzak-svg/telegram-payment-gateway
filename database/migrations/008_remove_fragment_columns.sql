-- Migration: Remove Fragment columns and add DEX columns
-- Date: 2024-11-18
-- Description: Transition from Fragment.com API to decentralized DEX (DeDust, Ston.fi)

-- Remove Fragment-specific columns from conversions table
ALTER TABLE conversions 
  DROP COLUMN IF EXISTS fragment_tx_id,
  DROP COLUMN IF EXISTS fragment_status;

-- Add DEX-specific columns
ALTER TABLE conversions 
  ADD COLUMN IF NOT EXISTS dex_pool_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dex_provider VARCHAR(50) CHECK (dex_provider IN ('dedust', 'stonfi', 'p2p')),
  ADD COLUMN IF NOT EXISTS dex_tx_hash VARCHAR(255);

-- Update fee_breakdown JSONB structure (remove fragment, add dex)
-- Only update rows that have the 'fragment' key
UPDATE conversions 
SET fee_breakdown = jsonb_set(
  fee_breakdown - 'fragment',
  '{dex}',
  COALESCE(fee_breakdown->'fragment', '0')::jsonb
)
WHERE fee_breakdown ? 'fragment';

-- Drop old Fragment index
DROP INDEX IF EXISTS idx_conversions_fragment_tx;

-- Create new DEX indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversions_dex_pool ON conversions(dex_pool_id);
CREATE INDEX IF NOT EXISTS idx_conversions_dex_provider ON conversions(dex_provider);
CREATE INDEX IF NOT EXISTS idx_conversions_dex_tx_hash ON conversions(dex_tx_hash);

-- Add comment for documentation
COMMENT ON COLUMN conversions.dex_pool_id IS 'DEX liquidity pool identifier (DeDust or Ston.fi)';
COMMENT ON COLUMN conversions.dex_provider IS 'DEX provider: dedust, stonfi, or p2p';
COMMENT ON COLUMN conversions.dex_tx_hash IS 'DEX swap transaction hash on TON blockchain';
