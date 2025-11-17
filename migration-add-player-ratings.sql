-- Create player_ratings table for USATT rating system
create table public.player_ratings (
  id uuid default uuid_generate_v4() primary key,
  player_id uuid references public.participants(id) on delete cascade not null,
  league_id uuid references public.leagues(id) on delete cascade not null,
  current_rating integer not null default 1200,
  matches_played integer not null default 0,
  is_provisional boolean not null default true,
  last_updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(player_id, league_id)
);

-- Create trigger for player_ratings updated_at
create trigger update_player_ratings_updated_at before update on public.player_ratings
  for each row execute function public.update_updated_at_column();

-- Enable RLS for player_ratings
alter table public.player_ratings enable row level security;

-- RLS Policies for player_ratings
create policy "Anyone can view player ratings" on public.player_ratings for select using (true);
create policy "League admins can manage player ratings" on public.player_ratings for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = player_ratings.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Create indexes for performance
create index idx_player_ratings_player on public.player_ratings(player_id);
create index idx_player_ratings_league on public.player_ratings(league_id);
create index idx_player_ratings_league_player on public.player_ratings(league_id, player_id);
create index idx_player_ratings_rating on public.player_ratings(current_rating);

-- Initialize ratings for existing participants
-- This will create rating records for all existing participants in all leagues
insert into public.player_ratings (player_id, league_id, current_rating, matches_played, is_provisional)
select 
  p.id as player_id,
  p.league_id,
  1200 as current_rating,
  0 as matches_played,
  true as is_provisional
from public.participants p
on conflict (player_id, league_id) do nothing;
