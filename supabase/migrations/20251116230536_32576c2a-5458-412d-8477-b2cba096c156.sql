-- Create function to update timestamps (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table to track events that need monitoring
CREATE TABLE IF NOT EXISTS public.event_monitoring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  date_found TEXT,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.event_monitoring ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to event monitoring"
ON public.event_monitoring
FOR SELECT
USING (true);

-- Create policy for service role to insert/update
CREATE POLICY "Allow service role to manage event monitoring"
ON public.event_monitoring
FOR ALL
USING (true);

-- Create indexes for faster queries
CREATE INDEX idx_event_monitoring_date_null ON public.event_monitoring(organization_name, event_name) WHERE date_found IS NULL;
CREATE INDEX idx_event_monitoring_last_checked ON public.event_monitoring(last_checked);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_event_monitoring_updated_at
BEFORE UPDATE ON public.event_monitoring
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();