-- Sample seed data for development
-- Insert sample user
INSERT INTO users (id, apikey, apisecret, appname, webhookurl, kycstatus)
VALUES 
  (gen_random_uuid(), 'dev_api_key_123', 'dev_api_secret_456', 'Dev Test App', 'http://localhost:3001/webhook', 'pending')
ON CONFLICT DO NOTHING;

-- Sample exchange rates
INSERT INTO exchangerates (id, sourcecurrency, targetcurrency, rate, source)
VALUES
  (gen_random_uuid(), 'STARS', 'TON', 0.0013, 'fragment'),
  (gen_random_uuid(), 'TON', 'USD', 2.45, 'coingecko'),
  (gen_random_uuid(), 'TON', 'EUR', 2.28, 'coingecko')
ON CONFLICT DO NOTHING;

COMMIT;
