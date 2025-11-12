-- ============================================
-- RECONCILIATION RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reconciliation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    conversion_id UUID REFERENCES conversions(id) ON DELETE SET NULL,
    expected_amount DECIMAL(20, 8) NOT NULL,
    actual_amount DECIMAL(20, 8) NOT NULL,
    difference DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('matched', 'mismatch', 'pending')),
    reconciliation_type VARCHAR(20) CHECK (reconciliation_type IN ('payment', 'conversion', 'settlement')),
    external_reference VARCHAR(255),
    notes TEXT,
    reconciled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for reconciliation
CREATE INDEX idx_reconciliation_payment_id ON reconciliation_records(payment_id);
CREATE INDEX idx_reconciliation_conversion_id ON reconciliation_records(conversion_id);
CREATE INDEX idx_reconciliation_status ON reconciliation_records(status);
CREATE INDEX idx_reconciliation_type ON reconciliation_records(reconciliation_type);
CREATE INDEX idx_reconciliation_created_at ON reconciliation_records(created_at DESC);

-- ============================================
-- ENHANCED WEBHOOK EVENTS (if not in 001)
-- ============================================
-- Add additional webhook columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='webhook_events' AND column_name='signature') THEN
        ALTER TABLE webhook_events 
        ADD COLUMN signature VARCHAR(255),
        ADD COLUMN next_retry_at TIMESTAMP,
        ADD COLUMN delivered_at TIMESTAMP;
    END IF;
END $$;

-- ============================================
-- TON PAYMENT TABLES (Direct TON payments)
-- ============================================
CREATE TABLE IF NOT EXISTS ton_payment_invoices (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    amount_ton DECIMAL(20, 9) NOT NULL,
    amount_nano VARCHAR(255) NOT NULL,
    memo VARCHAR(500) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(255),
    received_amount_ton DECIMAL(20, 9),
    deep_link TEXT,
    qr_code_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    confirmed_at TIMESTAMP
);

CREATE INDEX idx_ton_invoices_user ON ton_payment_invoices(user_id);
CREATE INDEX idx_ton_invoices_status ON ton_payment_invoices(status);
CREATE INDEX idx_ton_invoices_memo ON ton_payment_invoices(memo);
CREATE INDEX idx_ton_invoices_created ON ton_payment_invoices(created_at DESC);

-- TON Withdrawals
CREATE TABLE IF NOT EXISTS ton_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_address VARCHAR(255) NOT NULL,
    amount_ton DECIMAL(20, 9) NOT NULL,
    fee_ton DECIMAL(20, 9) NOT NULL,
    memo TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_ton_withdrawals_user ON ton_withdrawals(user_id);
CREATE INDEX idx_ton_withdrawals_status ON ton_withdrawals(status);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE reconciliation_records IS 'Payment and conversion reconciliation for data integrity';
COMMENT ON TABLE ton_payment_invoices IS 'Direct TON cryptocurrency payment invoices';
COMMENT ON TABLE ton_withdrawals IS 'TON cryptocurrency withdrawal requests';
