const { createClient } = require('@supabase/supabase-js')

// Load environment variables manually
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')
  const envVars = {}
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, value] = trimmedLine.split('=')
      if (key && value) {
        envVars[key.trim()] = value.trim()
      }
    }
  })
  
  return envVars
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('Applying column name fix migration...')
    
    // Check if the column exists first
    const { data: columns, error: columnError } = await supabase
      .rpc('sql', {
        query: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'player_ratings' 
          AND column_name IN ('last_updated_at', 'updated_at')
        `
      })
    
    if (columnError) {
      console.error('Error checking columns:', columnError)
      return
    }
    
    console.log('Current columns found:', columns)
    
    const hasLastUpdatedAt = columns.some(col => col.column_name === 'last_updated_at')
    const hasUpdatedAt = columns.some(col => col.column_name === 'updated_at')
    
    if (hasLastUpdatedAt && !hasUpdatedAt) {
      console.log('Found last_updated_at column, renaming to updated_at...')
      
      const { error: renameError } = await supabase
        .rpc('sql', {
          query: 'ALTER TABLE public.player_ratings RENAME COLUMN last_updated_at TO updated_at;'
        })
      
      if (renameError) {
        console.error('Error renaming column:', renameError)
        return
      }
      
      console.log('✅ Successfully renamed last_updated_at to updated_at')
    } else if (hasUpdatedAt) {
      console.log('✅ Column updated_at already exists, no migration needed')
    } else {
      console.error('❌ Neither last_updated_at nor updated_at column found')
      return
    }
    
    console.log('Migration completed successfully!')
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
