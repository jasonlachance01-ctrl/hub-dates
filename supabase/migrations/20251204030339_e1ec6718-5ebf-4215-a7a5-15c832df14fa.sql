-- Allow public read access to user_feedback for displaying average ratings
CREATE POLICY "Allow public read access" 
ON public.user_feedback 
FOR SELECT 
USING (true);