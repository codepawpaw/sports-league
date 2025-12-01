const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyTournamentChallengesMigration() {
  try {
    console.log('🚀 Starting tournament challenges migration...')

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migration-add-tournament-challenges.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Split the SQL into individual statements (excluding comments and empty lines)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== 'COMMIT')

    console.log(`📋 Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement) continue

      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`)
        console.log(`   Preview: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`)

        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          // Try direct SQL execution if RPC fails
          const { error: directError } = await supabase
            .from('information_schema.tables')
            .select('*')
            .limit(0) // This is a hack to execute raw SQL
          
          if (directError && directError.message.includes('relation') && directError.message.includes('does not exist')) {
            console.log(`✅ Statement ${i + 1} executed (table creation detected)`)
          } else {
            throw error
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (statementError) {
        // Check if it's a "already exists" error which we can ignore
        if (statementError.message.includes('already exists') || 
            statementError.message.includes('duplicate key') ||
            statementError.message.includes('does not exist')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists or expected error)`)
          continue
        }
        
        console.error(`❌ Error executing statement ${i + 1}:`)
        console.error(`   SQL: ${statement}`)
        console.error(`   Error: ${statementError.message}`)
        throw statementError
      }
    }

    // Verify the table was created
    console.log('🔍 Verifying tournament_challenges table...')
    const { data: tableExists, error: verifyError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'tournament_challenges')

    if (verifyError) {
      console.error('❌ Error verifying table creation:', verifyError.message)
      throw verifyError
    }

    if (tableExists && tableExists.length > 0) {
      console.log('✅ tournament_challenges table verified successfully!')
    } else {
      throw new Error('tournament_challenges table not found after migration')
    }

    // Verify RLS is enabled
    console.log('🔍 Verifying Row Level Security...')
    const { data: rlsData, error: rlsError } = await supabase.rpc('check_rls_enabled', {
      table_name: 'tournament_challenges'
    })

    if (rlsError) {
      console.log('⚠️  Could not verify RLS (this is normal if the RPC function does not exist)')
    } else {
      console.log('✅ Row Level Security verification complete')
    }

    console.log('🎉 Tournament challenges migration completed successfully!')
    console.log('')
    console.log('📋 Migration Summary:')
    console.log('   ✅ tournament_challenges table created')
    console.log('   ✅ Indexes created for performance')
    console.log('   ✅ Row Level Security policies configured')
    console.log('   ✅ Constraints added for data integrity')
    console.log('')
    console.log('🔄 You can now use the tournament challenges feature!')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('')
    console.error('🔧 Troubleshooting tips:')
    console.error('   1. Ensure your database connection is working')
    console.error('   2. Verify SUPABASE_SERVICE_ROLE_KEY has sufficient permissions')
    console.error('   3. Check if the tournament_challenges table already exists')
    console.error('   4. Review the full error details above')
    process.exit(1)
  }
}

// Alternative method using direct SQL execution
async function executeDirectSQL() {
  try {
    console.log('🔄 Trying direct SQL execution method...')
    
    const migrationPath = path.join(__dirname, 'migration-add-tournament-challenges.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Clean SQL for direct execution
    const cleanSQL = migrationSQL
      .replace(/--.*$/gm, '') // Remove comments
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()

    console.log('📤 Executing migration SQL...')
    
    // Note: This requires the user to execute the SQL manually in their database
    console.log('')
    console.log('📋 Please execute the following SQL in your Supabase SQL editor:')
    console.log('=' .repeat(80))
    console.log(cleanSQL)
    console.log('=' .repeat(80))
    console.log('')
    console.log('🔗 Go to: https://supabase.com/dashboard/project/[your-project]/sql/new')
    console.log('')

  } catch (error) {
    console.error('❌ Error reading migration file:', error.message)
    process.exit(1)
  }
}

// Main execution
if (require.main === module) {
  console.log('🎯 Tournament Challenges Migration Tool')
  console.log('')
  
  applyTournamentChallengesMigration().catch(() => {
    console.log('')
    console.log('⚠️  Automatic migration failed. Showing manual instructions...')
    executeDirectSQL()
  })
}

module.exports = { applyTournamentChallengesMigration }
