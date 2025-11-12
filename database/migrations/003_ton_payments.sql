-- TON Payment Invoices Table
CREATE TABLE IF NOT EXISTS ton_payment_invoices (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Payment details
  address VARCHAR(255) NOT NULL,
  amount_ton DECIMAL(20, 9) NOT NULL,
  amount_nano VARCHAR(255) NOT NULL,
  memo VARCHAR(500) NOT NULL UNIQUE,
  description TEXT,
  
  -- Payment status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  tx_hash VARCHAR(255),
  received_amount_ton DECIMAL(20, 9),
  
  -- Links and QR
  deep_link TEXT,
  qr_code_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ton_invoices_user ON ton_payment_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_ton_invoices_status ON ton_payment_invoices(status);
CREATE INDEX IF NOT EXISTS idx_ton_invoices_memo ON ton_payment_invoices(memo);
CREATE INDEX IF NOT EXISTS idx_ton_invoices_created ON ton_payment_invoices(created_at DESC);

-- TON Withdrawals Table
CREATE TABLE IF NOT EXISTS ton_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Withdrawal details
  to_address VARCHAR(255) NOT NULL,
  amount_ton DECIMAL(20, 9) NOT NULL,
  fee_ton DECIMAL(20, 9) NOT NULL,
  memo TEXT,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  tx_hash VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ton_withdrawals_user ON ton_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_ton_withdrawals_status ON ton_withdrawals(status);

COMMENT ON TABLE ton_payment_invoices IS 'TON cryptocurrency payment invoices';
COMMENT ON TABLE ton_withdrawals IS 'TON cryptocurrency withdrawal requests';
