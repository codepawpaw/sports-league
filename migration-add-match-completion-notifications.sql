-- Add notify_match_completions column to league_chat_integrations table
ALTER TABLE public.league_chat_integrations 
ADD COLUMN notify_match_completions boolean DEFAULT true NOT NULL;

-- Add comment to document the new column
COMMENT ON COLUMN public.league_chat_integrations.notify_match_completions IS 'Whether to send notifications when matches are completed with final scores';
