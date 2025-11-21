-- Platform fees tracking table
CREATE TABLE IF NOT EXISTS platform_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relationship
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    conversion_id UUID REFERENCES conversions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Fee details
    fee_percentage DECIMAL(5,4) NOT NULL, -- e.g., 0.0150 = 1.5%
    fee_amount_stars DECIMAL(20,8) NOT NULL,
    fee_amount_ton DECIMAL(20,8),
    fee_amount_usd DECIMAL(20,8),
    
    -- Collection status
    status VARCHAR(50) DEFAULT 'pending', -- pending, collected, failed
    collection_tx_hash TEXT,
    collected_at TIMESTAMP,
    
    -- Metadata
    fee_type VARCHAR(50) DEFAULT 'platform', -- platform, referral, bonus
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform wallet configuration
CREATE TABLE IF NOT EXISTS platform_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Fee configuration
    platform_fee_percentage DECIMAL(5,4) DEFAULT 0.0150, -- 1.5%
    fragment_fee_percentage DECIMAL(5,4) DEFAULT 0.0050, -- 0.5%
    network_fee_percentage DECIMAL(5,4) DEFAULT 0.0010, -- 0.1%
    
    -- Wallet addresses
    platform_ton_wallet TEXT NOT NULL,
    platform_stars_wallet TEXT,
    
    -- Minimum amounts
    min_conversion_amount INTEGER DEFAULT 1000,
    min_fee_collection_amount DECIMAL(20,8) DEFAULT 1.0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_platform_fees_payment ON platform_fees(payment_id);
CREATE INDEX idx_platform_fees_conversion ON platform_fees(conversion_id);
CREATE INDEX idx_platform_fees_user ON platform_fees(user_id, created_at DESC);
CREATE INDEX idx_platform_fees_status ON platform_fees(status);
CREATE INDEX idx_platform_fees_created ON platform_fees(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_platform_fees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_platform_fees_updated_at
    BEFORE UPDATE ON platform_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_platform_fees_updated_at();

CREATE TRIGGER trigger_platform_config_updated_at
    BEFORE UPDATE ON platform_config
    FOR EACH ROW
    EXECUTE FUNCTION update_platform_fees_updated_at();

-- Insert default platform configuration
INSERT INTO platform_config (
    platform_fee_percentage,
    fragment_fee_percentage,
    network_fee_percentage,
    platform_ton_wallet,
    min_conversion_amount
) VALUES (
    0.0150, -- 1.5% platform fee
    0.0050, -- 0.5% fragment fee
    0.0010, -- 0.1% network fee
    'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2', -- Your TON wallet
    1000
) ON CONFLICT DO NOTHING;

-- Add fee tracking to conversions table
ALTER TABLE conversions 
ADD COLUMN IF NOT EXISTS platform_fee_amount DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5,4);

-- Analytics view
CREATE OR REPLACE VIEW platform_revenue_summary AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_fees,
    SUM(fee_amount_stars) as total_stars_fees,
    SUM(fee_amount_ton) as total_ton_fees,
    SUM(fee_amount_usd) as total_usd_fees,
    COUNT(CASE WHEN status = 'collected' THEN 1 END) as collected_count,
    SUM(CASE WHEN status = 'collected' THEN fee_amount_ton ELSE 0 END) as collected_ton
FROM platform_fees
GROUP BY DATE(created_at)
ORDER BY date DESC;

COMMENT ON TABLE platform_fees IS 'Tracks all platform fees collected from conversions';
COMMENT ON TABLE platform_config IS 'Platform-wide fee configuration and wallet addresses';
COMMENT ON VIEW platform_revenue_summary IS 'Daily revenue summary for platform analytics';
