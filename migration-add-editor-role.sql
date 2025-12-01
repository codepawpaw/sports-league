-- Add league_editors table for editor role management
create table public.league_editors (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  email varchar(255) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(league_id, email)
);

-- Create indexes for performance
create index idx_league_editors_league_email on public.league_editors(league_id, email);

-- Enable RLS for league_editors
alter table public.league_editors enable row level security;

-- RLS Policies for league_editors
create policy "Anyone can view league editors" on public.league_editors for select using (true);
create policy "League admins can manage editors" on public.league_editors for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = league_editors.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Update existing RLS policies to include editor permissions for UPDATE operations only
-- Participants: editors can update but not create/delete
drop policy "League admins can manage participants" on public.participants;
create policy "League admins can manage participants" on public.participants for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = participants.league_id 
    and email = auth.jwt() ->> 'email'
  )
);
create policy "League editors can update participants" on public.participants for update using (
  exists (
    select 1 from public.league_editors 
    where league_id = participants.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Matches: editors can update but not create/delete
drop policy "League admins can manage matches" on public.matches;
create policy "League admins can manage matches" on public.matches for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
);
create policy "League editors can update matches" on public.matches for update using (
  exists (
    select 1 from public.league_editors 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Match sets: editors can update but not create/delete  
drop policy "League admins can manage match sets" on public.match_sets;
create policy "League admins can manage match sets" on public.match_sets for all using (
  exists (
    select 1 from public.league_admins la
    join public.matches m on m.league_id = la.league_id
    where m.id = match_sets.match_id 
    and la.email = auth.jwt() ->> 'email'
  )
);
create policy "League editors can update match sets" on public.match_sets for update using (
  exists (
    select 1 from public.league_editors le
    join public.matches m on m.league_id = le.league_id
    where m.id = match_sets.match_id 
    and le.email = auth.jwt() ->> 'email'
  )
);

-- Seasons: editors can update but not create/delete
drop policy "League admins can manage seasons" on public.seasons;
create policy "League admins can manage seasons" on public.seasons for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = seasons.league_id 
    and email = auth.jwt() ->> 'email'
  )
);
create policy "League editors can update seasons" on public.seasons for update using (
  exists (
    select 1 from public.league_editors 
    where league_id = seasons.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Player registration requests: editors can update but not create/delete
drop policy "League admins can manage registration requests" on public.player_registration_requests;
create policy "League admins can manage registration requests" on public.player_registration_requests for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = player_registration_requests.league_id 
    and email = auth.jwt() ->> 'email'
  )
);
create policy "League editors can update registration requests" on public.player_registration_requests for update using (
  exists (
    select 1 from public.league_editors 
    where league_id = player_registration_requests.league_id 
    and email = auth.jwt() ->> 'email'
  )
);
