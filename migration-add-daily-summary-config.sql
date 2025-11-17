-- Add daily summary configuration columns to league_chat_integrations table
ALTER TABLE league_chat_integrations ADD COLUMN IF NOT EXISTS daily_summary_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE league_chat_integrations ADD COLUMN IF NOT EXISTS daily_summary_time TIME DEFAULT '09:00:00';
ALTER TABLE league_chat_integrations ADD COLUMN IF NOT EXISTS summary_include_streaks BOOLEAN DEFAULT TRUE;
ALTER TABLE league_chat_integrations ADD COLUMN IF NOT EXISTS summary_include_rankings BOOLEAN DEFAULT TRUE;
ALTER TABLE league_chat_integrations ADD COLUMN IF NOT EXISTS summary_include_schedule BOOLEAN DEFAULT TRUE;
ALTER TABLE league_chat_integrations ADD COLUMN IF NOT EXISTS last_summary_sent TIMESTAMP WITH TIME ZONE;
