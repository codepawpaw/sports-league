-- Create league_chat_integrations table
create table public.league_chat_integrations (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null unique,
  webhook_url varchar(1000) not null,
  enabled boolean default true not null,
  notify_new_matches boolean default true not null,
  notify_approved_schedules boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create trigger for league_chat_integrations updated_at
create trigger update_league_chat_integrations_updated_at before update on public.league_chat_integrations
  for each row execute function public.update_updated_at_column();

-- Enable RLS for league_chat_integrations
alter table public.league_chat_integrations enable row level security;

-- RLS Policies for league_chat_integrations
create policy "League admins can view chat integrations" on public.league_chat_integrations for select using (
  exists (
    select 1 from public.league_admins 
    where league_id = league_chat_integrations.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

create policy "League admins can manage chat integrations" on public.league_chat_integrations for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = league_chat_integrations.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Create indexes for performance
create index idx_league_chat_integrations_league on public.league_chat_integrations(league_id);
create index idx_league_chat_integrations_enabled on public.league_chat_integrations(league_id, enabled);
