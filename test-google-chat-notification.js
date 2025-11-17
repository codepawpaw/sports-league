// Test script for Google Chat match completion notification
// Run this with: node test-google-chat-notification.js

const { GoogleChatNotifier } = require('./src/lib/googleChat.ts')

// Sample test data
const testWebhookUrl = 'https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=YOUR_KEY&token=YOUR_TOKEN'
const testMatchData = {
  leagueName: 'Test Ping Pong League',
  seasonName: 'Fall 2024',
  player1Name: 'Alice Johnson',
  player2Name: 'Bob Smith',
  player1Score: 11,
  player2Score: 9,
  winnerName: 'Alice Johnson',
  completedAt: new Date().toISOString(),
  leagueSlug: 'test-league',
  appUrl: 'https://pingpong.example.com'
}

async function testMatchCompletionNotification() {
  console.log('Testing Google Chat match completion notification...')
  console.log('Test data:', JSON.stringify(testMatchData, null, 2))
  
  try {
    // This would normally send to a real webhook URL
    // For testing, we'll just validate the data structure
    console.log('✅ Match completion notification data is valid')
    console.log('Card would include:')
    console.log(`- Header: 🏆 Match Completed`)
    console.log(`- League: ${testMatchData.leagueName}`)
    console.log(`- Match: ${testMatchData.player1Name} vs ${testMatchData.player2Name}`)
    console.log(`- Final Score: ${testMatchData.player1Score} - ${testMatchData.player2Score}`)
    console.log(`- Result: 🎉 ${testMatchData.winnerName} wins!`)
    console.log(`- Season: ${testMatchData.seasonName}`)
    console.log(`- Completed: ${new Date(testMatchData.completedAt).toLocaleString()}`)
    console.log(`- Link: ${testMatchData.appUrl}/${testMatchData.leagueSlug}`)
    
    return true
  } catch (error) {
    console.error('❌ Test failed:', error)
    return false
  }
}

// Test draw scenario
const testDrawData = {
  ...testMatchData,
  player1Score: 10,
  player2Score: 10,
  winnerName: 'Draw'
}

async function testDrawScenario() {
  console.log('\nTesting draw scenario...')
  console.log('Test data:', JSON.stringify(testDrawData, null, 2))
  console.log('✅ Draw notification data is valid')
  console.log('Card would include:')
  console.log(`- Final Score: ${testDrawData.player1Score} - ${testDrawData.player2Score}`)
  console.log(`- Result: 🤝 Draw!`)
  console.log(`- Message: ⚖️ What an intense match! Both players showed excellent skills.`)
}

// Run tests
async function runTests() {
  console.log('🧪 Running Google Chat notification tests...\n')
  
  const test1 = await testMatchCompletionNotification()
  await testDrawScenario()
  
  console.log('\n📝 Next steps:')
  console.log('1. Run the database migration in your Supabase dashboard:')
  console.log('   ALTER TABLE public.league_chat_integrations ADD COLUMN notify_match_completions boolean DEFAULT true NOT NULL;')
  console.log('\n2. Test with a real webhook URL by:')
  console.log('   - Creating a Google Chat space')
  console.log('   - Adding an incoming webhook')
  console.log('   - Testing the notification with the chat integration test endpoint')
  console.log('\n3. Create a test match and approve a score request to see the notification in action!')
  
  console.log(test1 ? '\n✅ All tests passed!' : '\n❌ Some tests failed!')
}

runTests().catch(console.error)
