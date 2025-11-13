-- Fee Collections Table (platform owner withdrawals)
CREATE TABLE IF NOT EXISTS fee_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fee_ids UUID[] NOT NULL,
    target_address VARCHAR(255) NOT NULL,
    total_fees_stars DECIMAL(20, 8) NOT NULL,
    total_fees_ton DECIMAL(20, 8) NOT NULL,
    total_fees_usd DECIMAL(20, 2) NOT NULL,
    fees_collected INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    tx_hash VARCHAR(255),
    error_message TEXT,
    collected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fee_collections_user_id ON fee_collections(user_id);
CREATE INDEX idx_fee_collections_status ON fee_collections(status);
CREATE INDEX idx_fee_collections_created_at ON fee_collections(created_at DESC);

COMMENT ON TABLE fee_collections IS 'Platform fee collection and withdrawal tracking for platform owner';
