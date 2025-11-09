-- Additional covering indexes for common query patterns

-- Fast lookup of user's recent payments with status
CREATE INDEX idx_payments_user_status_recent ON payments(user_id, status, created_at DESC)
  INCLUDE (stars_amount, telegram_payment_id);

-- Fast lookup of user's conversions with detailed info
CREATE INDEX idx_conversions_user_detailed ON conversions(user_id, status, created_at DESC)
  INCLUDE (source_amount, target_amount, fragment_tx_id);

-- Fast settlement tracking
CREATE INDEX idx_settlements_user_detailed ON settlements(user_id, status, created_at DESC)
  INCLUDE (fiat_amount, fiat_currency);

-- Rate lookup optimization
CREATE INDEX idx_rates_latest ON exchange_rates(source_currency, target_currency, created_at DESC)
  WHERE expires_at > NOW();

-- Active API keys lookup
CREATE INDEX idx_active_api_keys ON api_keys(user_id, is_active)
  WHERE is_active = true AND expires_at > NOW();
