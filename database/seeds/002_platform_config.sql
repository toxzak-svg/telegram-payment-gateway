-- Platform Configuration with TON Wallet
-- This seed file sets up the platform configuration for fee collection

-- Update or insert platform configuration
INSERT INTO platform_config (
    id,
    platform_fee_percentage,
    dex_fee_percentage,
    network_fee_percentage,
    dex_slippage_tolerance,
    preferred_dex_provider,
    platform_ton_wallet,
    min_conversion_amount,
    min_fee_collection_amount,
    is_active,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    0.0150,  -- 1.5% platform fee
    0.0050,  -- 0.5% DEX fee
    0.0010,  -- 0.1% network fee
    0.0050,  -- 0.5% slippage tolerance
    'dedust', -- Preferred DEX: dedust, stonfi, or auto
    'UQABzHv6ODc8RIthqZePq96MSAVwvPL1-VuIePTnEXDi0jTP', -- Platform TON wallet
    1000,    -- Minimum 1000 Stars per conversion
    1.0,     -- Collect fees when >= 1 TON accumulated
    true,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    platform_ton_wallet = EXCLUDED.platform_ton_wallet,
    dex_slippage_tolerance = EXCLUDED.dex_slippage_tolerance,
    preferred_dex_provider = EXCLUDED.preferred_dex_provider,
    updated_at = NOW();

-- Display current configuration
SELECT 
    platform_fee_percentage,
    dex_fee_percentage,
    network_fee_percentage,
    platform_ton_wallet,
    min_conversion_amount,
    min_fee_collection_amount,
    is_active
FROM platform_config
WHERE is_active = true;

COMMENT ON TABLE platform_config IS 'Platform-wide configuration including fee percentages and wallet addresses';
