-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create leagues table
create table public.leagues (
  id uuid default uuid_generate_v4() primary key,
  name varchar(255) not null,
  slug varchar(255) unique not null,
  description text,
  sets_per_match integer default 3 check (sets_per_match > 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create league_admins table
create table public.league_admins (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  email varchar(255) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(league_id, email)
);

-- Create participants table  
create table public.participants (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  name varchar(255) not null,
  email varchar(255),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(league_id, name)
);

-- Create matches table
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  player1_id uuid references public.participants(id) on delete cascade not null,
  player2_id uuid references public.participants(id) on delete cascade not null,
  player1_score integer default 0,
  player2_score integer default 0,
  status varchar(20) default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint different_players check (player1_id != player2_id)
);

-- Create match_sets table
create table public.match_sets (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  set_number integer not null check (set_number > 0),
  player1_score integer not null default 0 check (player1_score >= 0),
  player2_score integer not null default 0 check (player2_score >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(match_id, set_number)
);

-- Create function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_leagues_updated_at before update on public.leagues
  for each row execute function public.update_updated_at_column();

create trigger update_participants_updated_at before update on public.participants
  for each row execute function public.update_updated_at_column();

create trigger update_matches_updated_at before update on public.matches
  for each row execute function public.update_updated_at_column();

-- Enable Row Level Security
alter table public.leagues enable row level security;
alter table public.league_admins enable row level security;
alter table public.participants enable row level security;
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;

-- RLS Policies

-- leagues: anyone can read, only authenticated users can create
create policy "Anyone can view leagues" on public.leagues for select using (true);
create policy "Authenticated users can create leagues" on public.leagues for insert with check (auth.role() = 'authenticated');
create policy "League admins can update leagues" on public.leagues for update using (
  exists (
    select 1 from public.league_admins 
    where league_id = leagues.id 
    and email = auth.jwt() ->> 'email'
  )
);

-- league_admins: only league admins can manage
create policy "Anyone can view league admins" on public.league_admins for select using (true);
create policy "Authenticated users can create league admins" on public.league_admins for insert with check (auth.role() = 'authenticated');
create policy "League admins can manage admins" on public.league_admins for update using (
  exists (
    select 1 from public.league_admins la
    where la.league_id = league_admins.league_id 
    and la.email = auth.jwt() ->> 'email'
  )
);
create policy "League admins can delete admins" on public.league_admins for delete using (
  exists (
    select 1 from public.league_admins la
    where la.league_id = league_admins.league_id 
    and la.email = auth.jwt() ->> 'email'
  )
);

-- participants: anyone can read, league admins can manage
create policy "Anyone can view participants" on public.participants for select using (true);
create policy "League admins can manage participants" on public.participants for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = participants.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- matches: anyone can read, league admins can manage
create policy "Anyone can view matches" on public.matches for select using (true);
create policy "League admins can manage matches" on public.matches for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- match_sets: anyone can read, league admins can manage
create policy "Anyone can view match sets" on public.match_sets for select using (true);
create policy "League admins can manage match sets" on public.match_sets for all using (
  exists (
    select 1 from public.league_admins la
    join public.matches m on m.league_id = la.league_id
    where m.id = match_sets.match_id 
    and la.email = auth.jwt() ->> 'email'
  )
);

-- Create seasons table
create table public.seasons (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  name varchar(255) not null,
  slug varchar(255) not null,
  description text,
  is_active boolean default true,
  is_finished boolean default false,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(league_id, slug)
);

-- Add unique constraint to ensure only one active season per league
create unique index idx_one_active_season_per_league 
on public.seasons(league_id) 
where (is_active = true);

-- Add season_id to participants table
alter table public.participants add column season_id uuid references public.seasons(id) on delete cascade;

-- Add season_id to matches table  
alter table public.matches add column season_id uuid references public.seasons(id) on delete cascade;

-- Create trigger for seasons updated_at
create trigger update_seasons_updated_at before update on public.seasons
  for each row execute function public.update_updated_at_column();

-- Enable RLS for seasons
alter table public.seasons enable row level security;

-- RLS Policies for seasons
create policy "Anyone can view seasons" on public.seasons for select using (true);
create policy "League admins can manage seasons" on public.seasons for all using (
  exists (
    select 1 from public.league_admins 
    where league_id = seasons.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Create default seasons for existing leagues
insert into public.seasons (league_id, name, slug, description, is_active)
select 
  id as league_id,
  'Season 1' as name,
  'season-1' as slug,
  'Initial season' as description,
  true as is_active
from public.leagues;

-- Update existing participants to belong to default seasons
update public.participants 
set season_id = (
  select s.id 
  from public.seasons s 
  where s.league_id = participants.league_id 
  and s.slug = 'season-1'
);

-- Update existing matches to belong to default seasons
update public.matches 
set season_id = (
  select s.id 
  from public.seasons s 
  where s.league_id = matches.league_id 
  and s.slug = 'season-1'
);

-- Make season_id not null after migration
alter table public.participants alter column season_id set not null;
alter table public.matches alter column season_id set not null;


-- Create indexes for performance
create index idx_leagues_slug on public.leagues(slug);
create index idx_league_admins_league_email on public.league_admins(league_id, email);
create index idx_participants_league on public.participants(league_id);
create index idx_participants_season on public.participants(season_id);
create index idx_matches_league on public.matches(league_id);
create index idx_matches_season on public.matches(season_id);
create index idx_matches_players on public.matches(player1_id, player2_id);
create index idx_matches_status on public.matches(status);
create index idx_match_sets_match on public.match_sets(match_id);
create index idx_seasons_league on public.seasons(league_id);
create index idx_seasons_active on public.seasons(league_id, is_active);
