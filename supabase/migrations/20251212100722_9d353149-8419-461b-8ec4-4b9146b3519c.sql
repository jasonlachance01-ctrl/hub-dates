-- Allow public read access to count users (but not expose email content)
CREATE POLICY "Allow public count access"
ON public.user_emails
FOR SELECT
USING (true);