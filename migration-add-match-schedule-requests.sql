-- Create match_schedule_requests table
create table public.match_schedule_requests (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  requester_id uuid references public.participants(id) on delete cascade not null,
  opponent_id uuid references public.participants(id) on delete cascade not null,
  requested_date timestamp with time zone not null,
  message text,
  status varchar(20) default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reviewed_at timestamp with time zone,
  reviewed_by varchar(255),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(match_id, status) -- Only one pending request per match
);

-- Create trigger for match_schedule_requests updated_at
create trigger update_match_schedule_requests_updated_at before update on public.match_schedule_requests
  for each row execute function public.update_updated_at_column();

-- Enable RLS for match_schedule_requests
alter table public.match_schedule_requests enable row level security;

-- RLS Policies for match_schedule_requests
create policy "Anyone can view schedule requests" on public.match_schedule_requests for select using (true);
create policy "Authenticated users can create schedule requests" on public.match_schedule_requests for insert with check (auth.role() = 'authenticated');
create policy "Request creators and opponents can update" on public.match_schedule_requests for update using (
  exists (
    select 1 from public.participants p
    where (p.id = match_schedule_requests.requester_id or p.id = match_schedule_requests.opponent_id)
    and p.email = auth.jwt() ->> 'email'
  )
);

-- Create indexes for performance
create index idx_match_schedule_requests_match on public.match_schedule_requests(match_id);
create index idx_match_schedule_requests_requester on public.match_schedule_requests(requester_id);
create index idx_match_schedule_requests_opponent on public.match_schedule_requests(opponent_id);
create index idx_match_schedule_requests_status on public.match_schedule_requests(status);
