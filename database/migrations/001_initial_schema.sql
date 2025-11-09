-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key VARCHAR(255) UNIQUE NOT NULL,
  api_secret VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) NOT NULL,
  description TEXT,
  webhook_url TEXT,
  settlement_address VARCHAR(255),
  kyc_status VARCHAR(50) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  kyc_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_invoice_id VARCHAR(255),
  telegram_payment_id VARCHAR(255) UNIQUE NOT NULL,
  provider_payment_id VARCHAR(255),
  user_telegram_id BIGINT,
  user_telegram_username VARCHAR(255),
  stars_amount DECIMAL(18, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'received' CHECK (status IN (
    'pending', 'received', 'converting', 'converted', 'settled', 'failed', 'refunded'
  )),
  raw_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);

-- ============================================
-- CONVERSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_ids UUID[] DEFAULT ARRAY[]::UUID[],
  source_currency VARCHAR(10) DEFAULT 'STARS' CHECK (source_currency IN ('STARS')),
  target_currency VARCHAR(10) NOT NULL CHECK (target_currency IN ('TON', 'USD', 'EUR', 'GBP', 'USDT')),
  source_amount DECIMAL(18, 2) NOT NULL,
  target_amount DECIMAL(18, 2),
  exchange_rate DECIMAL(18, 8),
  rate_locked_until BIGINT,
  fragment_tx_id VARCHAR(255),
  fragment_status VARCHAR(50),
  ton_tx_hash VARCHAR(255),
  ton_block_height BIGINT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'rate_locked', 'phase1_prepared', 'phase2_committed', 
    'phase3_confirmed', 'completed', 'failed', 'rolled_back'
  )),
  fees JSONB DEFAULT '{}'::JSONB,
  fee_breakdown JSONB DEFAULT '{
    "telegram": 0,
    "fragment": 0,
    "ton": 0,
    "exchange": 0
  }'::JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================
-- SETTLEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversion_id UUID REFERENCES conversions(id) ON DELETE SET NULL,
  fiat_amount DECIMAL(18, 2) NOT NULL,
  fiat_currency VARCHAR(3) NOT NULL CHECK (fiat_currency IN ('USD', 'EUR', 'GBP', 'JPY', 'CNY')),
  exchange_platform VARCHAR(50),
  exchange_withdrawal_id VARCHAR(255),
  bank_account_id VARCHAR(255),
  recipient_name VARCHAR(255),
  recipient_bank_account VARCHAR(255),
  recipient_bank_routing VARCHAR(255),
  recipient_bank_swift VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'processing', 'completed', 'failed', 'cancelled'
  )),
  settlement_date TIMESTAMP,
  expected_arrival TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- EXCHANGE RATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_currency VARCHAR(10) NOT NULL,
  target_currency VARCHAR(10) NOT NULL,
  rate DECIMAL(18, 8) NOT NULL,
  source_provider VARCHAR(50) NOT NULL,
  bid_price DECIMAL(18, 8),
  ask_price DECIMAL(18, 8),
  low_24h DECIMAL(18, 8),
  high_24h DECIMAL(18, 8),
  volume_24h DECIMAL(18, 2),
  timestamp TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '5 minutes'
);

-- ============================================
-- WEBHOOK EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,
  error_message TEXT,
  sent_at TIMESTAMP,
  response_status INT,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- API KEYS TABLE (for multi-key support)
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  ip_whitelist TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Payments
CREATE INDEX idx_payments_user_id ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_telegram_id ON payments(telegram_payment_id);
CREATE INDEX idx_payments_user_telegram_id ON payments(user_telegram_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Conversions
CREATE INDEX idx_conversions_user_id ON conversions(user_id, created_at DESC);
CREATE INDEX idx_conversions_status ON conversions(status);
CREATE INDEX idx_conversions_fragment_tx ON conversions(fragment_tx_id);
CREATE INDEX idx_conversions_ton_tx ON conversions(ton_tx_hash);
CREATE INDEX idx_conversions_payment_ids ON conversions USING gin(payment_ids);
CREATE INDEX idx_conversions_created_at ON conversions(created_at DESC);

-- Settlements
CREATE INDEX idx_settlements_user_id ON settlements(user_id, created_at DESC);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_conversion_id ON settlements(conversion_id);
CREATE INDEX idx_settlements_created_at ON settlements(created_at DESC);

-- Exchange Rates
CREATE INDEX idx_exchange_rates_currency_pair ON exchange_rates(source_currency, target_currency, created_at DESC);
CREATE INDEX idx_exchange_rates_provider ON exchange_rates(source_provider);

-- Webhook Events
CREATE INDEX idx_webhook_events_user_id ON webhook_events(user_id, created_at DESC);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);

-- Audit Logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- API Keys
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- ============================================
-- FUNCTIONS FOR AUTO-UPDATE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversions_updated_at BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- User Summary
CREATE OR REPLACE VIEW user_summaries AS
SELECT 
  u.id,
  u.app_name,
  COUNT(DISTINCT p.id) as total_payments,
  COALESCE(SUM(p.stars_amount), 0) as total_stars_received,
  COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_conversions,
  COALESCE(SUM(CASE WHEN c.status = 'completed' THEN c.target_amount END), 0) as total_converted,
  MAX(p.created_at) as last_payment_at
FROM users u
LEFT JOIN payments p ON u.id = p.user_id
LEFT JOIN conversions c ON u.id = c.user_id
GROUP BY u.id, u.app_name;

-- Conversion Funnel
CREATE OR REPLACE VIEW conversion_funnels AS
SELECT 
  u.id,
  COUNT(DISTINCT CASE WHEN p.status = 'received' THEN p.id END) as payments_received,
  COUNT(DISTINCT CASE WHEN c.status != 'failed' THEN c.id END) as conversions_started,
  COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as conversions_completed,
  COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as settlements_completed
FROM users u
LEFT JOIN payments p ON u.id = p.user_id
LEFT JOIN conversions c ON u.id = c.user_id
LEFT JOIN settlements s ON u.id = s.user_id
GROUP BY u.id;
