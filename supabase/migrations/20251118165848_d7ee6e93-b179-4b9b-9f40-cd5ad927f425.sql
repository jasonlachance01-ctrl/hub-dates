-- Drop existing user-scoped policies first
DROP POLICY IF EXISTS "Users can view their own event monitoring" ON public.event_monitoring;
DROP POLICY IF EXISTS "Users can insert their own event monitoring" ON public.event_monitoring;
DROP POLICY IF EXISTS "Users can update their own event monitoring" ON public.event_monitoring;
DROP POLICY IF EXISTS "Users can delete their own event monitoring" ON public.event_monitoring;

-- Now remove user_id column
ALTER TABLE public.event_monitoring 
DROP COLUMN IF EXISTS user_id;

-- Create public access policies for beta use
CREATE POLICY "Allow public read access"
ON public.event_monitoring
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public insert access"
ON public.event_monitoring
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public update access"
ON public.event_monitoring
FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Allow public delete access"
ON public.event_monitoring
FOR DELETE
TO anon
USING (true);