-- Fix: Remove public read access to user emails (PII exposure)
DROP POLICY "Allow public read access" ON user_emails;