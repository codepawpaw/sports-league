-- Add challenge notification setting to existing league_chat_integrations table
alter table public.league_chat_integrations 
add column notify_challenge_requests boolean default true not null;

-- Update existing integrations to enable challenge notifications by default
update public.league_chat_integrations 
set notify_challenge_requests = true
where notify_challenge_requests is null;
