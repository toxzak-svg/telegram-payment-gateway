-- Create withdrawals table for fiat gateway
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  conversion_id UUID NOT NULL REFERENCES conversions(id),
  amount NUMERIC(20, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  gateway_id VARCHAR(50) NOT NULL,
  gateway_tx_id VARCHAR(255),
  gateway_fee NUMERIC(20, 8) NOT NULL DEFAULT 0,
  network_fee NUMERIC(20, 8) NOT NULL DEFAULT 0,
  total_fees NUMERIC(20, 8) NOT NULL DEFAULT 0,
  net_amount NUMERIC(20, 8) NOT NULL,
  recipient_details JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  estimated_arrival TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_conversion_id ON withdrawals(conversion_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at DESC);

COMMENT ON TABLE withdrawals IS 'Fiat withdrawal requests through various gateways';
