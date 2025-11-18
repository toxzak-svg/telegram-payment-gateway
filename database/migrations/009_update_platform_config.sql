-- Migration: Update platform config for DEX integration
-- Date: 2024-11-18
-- Description: Remove Fragment fee configuration and add DEX settings

-- Remove Fragment fee configuration
ALTER TABLE platform_config
  DROP COLUMN IF EXISTS fragment_fee_percentage;

-- Add DEX configuration columns
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS dex_fee_percentage DECIMAL(5,4) DEFAULT 0.0050, -- 0.5%
  ADD COLUMN IF NOT EXISTS dex_slippage_tolerance DECIMAL(5,4) DEFAULT 0.0050, -- 0.5%
  ADD COLUMN IF NOT EXISTS preferred_dex_provider VARCHAR(50) DEFAULT 'dedust' CHECK (preferred_dex_provider IN ('dedust', 'stonfi', 'auto'));

-- Update existing records to have DEX configuration
UPDATE platform_config 
SET dex_fee_percentage = 0.0050,
    dex_slippage_tolerance = 0.0050,
    preferred_dex_provider = 'dedust'
WHERE dex_fee_percentage IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN platform_config.dex_fee_percentage IS 'DEX swap fee percentage (default 0.5%)';
COMMENT ON COLUMN platform_config.dex_slippage_tolerance IS 'Maximum slippage tolerance for DEX swaps (default 0.5%)';
COMMENT ON COLUMN platform_config.preferred_dex_provider IS 'Preferred DEX provider: dedust, stonfi, or auto (best rate)';
