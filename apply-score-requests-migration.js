const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

// Directly set the environment variables from .env.local
const supabaseUrl = 'https://zoyximiqoufkekyqxfys.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpveXhpbWlxb3Vma2VreXF4ZnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUwMzA5MiwiZXhwIjoyMDc4MDc5MDkyfQ.LCBOEP9cu4FAc4VDLx9ZqT26CIPu5EYL65M-doKn5lo'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('Applying match_score_requests migration...')
  
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('migration-add-match-score-requests.sql', 'utf8')
    
    // Execute the migration
    const { data, error } = await supabase.rpc('execute_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('Migration failed:', error)
      
      // Try alternative approach: execute SQL directly
      console.log('Trying alternative approach...')
      const { data: sqlData, error: sqlError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'match_score_requests')
        .eq('table_schema', 'public')
      
      if (sqlError) {
        console.error('Error checking table existence:', sqlError)
      } else if (sqlData && sqlData.length === 0) {
        console.log('Table does not exist. Creating manually...')
        await createTableManually()
      } else {
        console.log('Table already exists!')
      }
    } else {
      console.log('Migration applied successfully!')
      console.log('Data:', data)
    }
    
  } catch (err) {
    console.error('Error reading migration file:', err)
    console.log('Creating table manually...')
    await createTableManually()
  }
}

async function createTableManually() {
  console.log('Creating match_score_requests table manually...')
  
  // Create the table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.match_score_requests (
      id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
      match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
      requester_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
      opponent_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
      player1_score integer NOT NULL,
      player2_score integer NOT NULL,
      message text,
      status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      requested_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      reviewed_at timestamp with time zone,
      reviewed_by varchar(255),
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      UNIQUE(match_id, status)
    );
  `
  
  try {
    const { error } = await supabase.rpc('exec_sql', { query: createTableSQL })
    if (error) {
      console.error('Error creating table:', error)
      return
    }
    console.log('Table created successfully!')
    
    // Create indexes
    await createIndexes()
    
    // Enable RLS and create policies
    await setupRLS()
    
    console.log('Migration completed successfully!')
    
  } catch (err) {
    console.error('Error in manual creation:', err)
  }
}

async function createIndexes() {
  console.log('Creating indexes...')
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_match_score_requests_match ON public.match_score_requests(match_id);',
    'CREATE INDEX IF NOT EXISTS idx_match_score_requests_requester ON public.match_score_requests(requester_id);',
    'CREATE INDEX IF NOT EXISTS idx_match_score_requests_opponent ON public.match_score_requests(opponent_id);',
    'CREATE INDEX IF NOT EXISTS idx_match_score_requests_status ON public.match_score_requests(status);'
  ]
  
  for (const indexSQL of indexes) {
    try {
      const { error } = await supabase.rpc('exec_sql', { query: indexSQL })
      if (error && !error.message.includes('already exists')) {
        console.error('Error creating index:', error)
      }
    } catch (err) {
      console.log('Index creation error (may already exist):', err.message)
    }
  }
  
  console.log('Indexes created!')
}

async function setupRLS() {
  console.log('Setting up Row Level Security...')
  
  try {
    // Enable RLS
    await supabase.rpc('exec_sql', { query: 'ALTER TABLE public.match_score_requests ENABLE ROW LEVEL SECURITY;' })
    
    // Create policies
    const policies = [
      'DROP POLICY IF EXISTS "Anyone can view score requests" ON public.match_score_requests;',
      'CREATE POLICY "Anyone can view score requests" ON public.match_score_requests FOR SELECT USING (true);',
      'DROP POLICY IF EXISTS "Authenticated users can create score requests" ON public.match_score_requests;',
      'CREATE POLICY "Authenticated users can create score requests" ON public.match_score_requests FOR INSERT WITH CHECK (auth.role() = \'authenticated\');',
      'DROP POLICY IF EXISTS "Request creators and opponents can update" ON public.match_score_requests;',
      `CREATE POLICY "Request creators and opponents can update" ON public.match_score_requests FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.participants p
          WHERE (p.id = match_score_requests.requester_id OR p.id = match_score_requests.opponent_id)
          AND p.email = auth.jwt() ->> 'email'
        )
      );`
    ]
    
    for (const policySQL of policies) {
      const { error } = await supabase.rpc('exec_sql', { query: policySQL })
      if (error && !error.message.includes('already exists')) {
        console.error('Policy error:', error)
      }
    }
    
    console.log('RLS policies set up!')
    
  } catch (err) {
    console.log('RLS setup error:', err.message)
  }
}

// Run the migration
applyMigration().then(() => {
  console.log('Migration process completed!')
  process.exit(0)
}).catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
