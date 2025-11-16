-- P2P Stars-to-TON marketplace tables

CREATE TABLE IF NOT EXISTS stars_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('sell', 'buy')),
  stars_amount DECIMAL(18, 2) NOT NULL,
  ton_amount DECIMAL(18, 8) NOT NULL,
  rate DECIMAL(18, 8) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('open', 'matched', 'locked', 'completed', 'failed', 'cancelled')),
  locked_until BIGINT,
  counter_order_id UUID REFERENCES stars_orders(id),
  telegram_escrow_tx VARCHAR(255),
  ton_wallet_tx VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stars_orders_user ON stars_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stars_orders_status ON stars_orders(status);
CREATE INDEX IF NOT EXISTS idx_stars_orders_type_status ON stars_orders(type, status, rate);

CREATE TABLE IF NOT EXISTS atomic_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sell_order_id UUID REFERENCES stars_orders(id) ON DELETE CASCADE,
  buy_order_id UUID REFERENCES stars_orders(id) ON DELETE CASCADE,
  smart_contract_address VARCHAR(255),
  ton_tx_hash VARCHAR(255),
  telegram_tx_id VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'ton_locked', 'stars_locked', 'completed', 'refunded')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atomic_swaps_sell ON atomic_swaps(sell_order_id);
CREATE INDEX IF NOT EXISTS idx_atomic_swaps_buy ON atomic_swaps(buy_order_id);
CREATE INDEX IF NOT EXISTS idx_atomic_swaps_status ON atomic_swaps(status);
