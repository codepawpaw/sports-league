-- Migration: Add Voting / Polls feature for league pages
-- Adds league-scoped polls with two types: 'custom' (admin-defined options)
-- and 'predefined_players' (options are existing participants of the league).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Polls table
CREATE TABLE public.league_polls (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  poll_type varchar(30) NOT NULL CHECK (poll_type IN ('custom', 'predefined_players')),
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by varchar(255),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Poll options table
CREATE TABLE public.league_poll_options (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id uuid REFERENCES public.league_polls(id) ON DELETE CASCADE NOT NULL,
  label varchar(255) NOT NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Poll votes table (one vote per user per poll)
CREATE TABLE public.league_poll_votes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id uuid REFERENCES public.league_polls(id) ON DELETE CASCADE NOT NULL,
  option_id uuid REFERENCES public.league_poll_options(id) ON DELETE CASCADE NOT NULL,
  voter_email varchar(255) NOT NULL,
  voter_user_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(poll_id, voter_email)
);

-- Indexes
CREATE INDEX idx_league_polls_league ON public.league_polls(league_id);
CREATE INDEX idx_league_polls_status ON public.league_polls(status);
CREATE INDEX idx_league_poll_options_poll ON public.league_poll_options(poll_id);
CREATE INDEX idx_league_poll_votes_poll ON public.league_poll_votes(poll_id);
CREATE INDEX idx_league_poll_votes_option ON public.league_poll_votes(option_id);
CREATE INDEX idx_league_poll_votes_voter ON public.league_poll_votes(voter_email);

-- updated_at triggers
CREATE TRIGGER update_league_polls_updated_at
  BEFORE UPDATE ON public.league_polls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_league_poll_votes_updated_at
  BEFORE UPDATE ON public.league_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Row Level Security
ALTER TABLE public.league_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls policies: anyone can view, admins/editors can manage
CREATE POLICY "Anyone can view league polls" ON public.league_polls
  FOR SELECT USING (true);

CREATE POLICY "League admins can manage polls" ON public.league_polls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.league_admins
      WHERE league_id = league_polls.league_id
      AND email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "League editors can manage polls" ON public.league_polls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.league_editors
      WHERE league_id = league_polls.league_id
      AND email = auth.jwt() ->> 'email'
    )
  );

-- Poll options policies
CREATE POLICY "Anyone can view poll options" ON public.league_poll_options
  FOR SELECT USING (true);

CREATE POLICY "League admins can manage poll options" ON public.league_poll_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.league_admins la
      JOIN public.league_polls p ON p.league_id = la.league_id
      WHERE p.id = league_poll_options.poll_id
      AND la.email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "League editors can manage poll options" ON public.league_poll_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.league_editors le
      JOIN public.league_polls p ON p.league_id = le.league_id
      WHERE p.id = league_poll_options.poll_id
      AND le.email = auth.jwt() ->> 'email'
    )
  );

-- Votes policies: anyone can read aggregate, only authenticated users can vote
CREATE POLICY "Anyone can view votes" ON public.league_poll_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can cast their vote" ON public.league_poll_votes
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND voter_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "Voters can update their own vote" ON public.league_poll_votes
  FOR UPDATE USING (
    voter_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "Voters can delete their own vote" ON public.league_poll_votes
  FOR DELETE USING (
    voter_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "League admins can manage votes" ON public.league_poll_votes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.league_admins la
      JOIN public.league_polls p ON p.league_id = la.league_id
      WHERE p.id = league_poll_votes.poll_id
      AND la.email = auth.jwt() ->> 'email'
    )
  );
