-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add user_id to conversions if missing (already in your schema, but safety check)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='conversions' AND column_name='user_id') THEN
        ALTER TABLE conversions 
        ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        
        CREATE INDEX idx_conversions_user_id_new ON conversions(user_id, created_at DESC);
    END IF;
END $$;

-- Ensure settlements has all needed columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='settlements' AND column_name='recipient_info') THEN
        ALTER TABLE settlements 
        ADD COLUMN recipient_info JSONB,
        ADD COLUMN transaction_id VARCHAR(255);
    END IF;
END $$;

-- Add webhook_url column to webhooks if needed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='webhook_events' AND column_name='webhook_url') THEN
        ALTER TABLE webhook_events 
        ADD COLUMN webhook_url TEXT,
        ADD COLUMN event VARCHAR(100),
        ADD COLUMN attempts INTEGER DEFAULT 0,
        ADD COLUMN max_attempts INTEGER DEFAULT 5;
    END IF;
END $$;

COMMENT ON TABLE settlements IS 'Fiat currency settlements and withdrawals';
