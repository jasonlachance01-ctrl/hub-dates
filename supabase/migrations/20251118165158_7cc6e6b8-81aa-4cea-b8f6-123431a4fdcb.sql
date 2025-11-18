-- Add user_id column to event_monitoring table
ALTER TABLE public.event_monitoring 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the public read policy
DROP POLICY IF EXISTS "Allow public read access to event monitoring" ON public.event_monitoring;

-- Create policies for authenticated users only
CREATE POLICY "Users can view their own event monitoring"
ON public.event_monitoring
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own event monitoring"
ON public.event_monitoring
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own event monitoring"
ON public.event_monitoring
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own event monitoring"
ON public.event_monitoring
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);