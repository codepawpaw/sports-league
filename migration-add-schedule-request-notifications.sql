-- Add notify_schedule_requests field to league_chat_integrations table
ALTER TABLE public.league_chat_integrations 
ADD COLUMN notify_schedule_requests boolean DEFAULT true NOT NULL;

-- Create index for the new field for performance
CREATE INDEX idx_league_chat_integrations_schedule_requests 
ON public.league_chat_integrations(league_id, enabled, notify_schedule_requests);
