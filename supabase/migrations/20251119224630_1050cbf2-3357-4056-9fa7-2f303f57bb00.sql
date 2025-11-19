-- Create a table to store user emails for calendar syncing
CREATE TABLE public.user_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;

-- Allow public read access (users can check if their email exists)
CREATE POLICY "Allow public read access" 
ON public.user_emails 
FOR SELECT 
USING (true);

-- Allow public insert access (users can register their email)
CREATE POLICY "Allow public insert access" 
ON public.user_emails 
FOR INSERT 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_emails_updated_at
BEFORE UPDATE ON public.user_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on email for faster lookups
CREATE INDEX idx_user_emails_email ON public.user_emails(email);