#!/usr/bin/env node

/**
 * Debug script for Google Chat challenge notifications
 * This script helps identify why challenge notifications aren't working
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - Update these with your actual values
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const LEAGUE_SLUG = process.argv[2] || 'your-league-slug'; // Pass as command line argument
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sports-league-tau.vercel.app';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-')) {
  console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  console.log('Usage: SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx node debug-challenge-notifications.js [league-slug]');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugChallengeNotifications() {
  console.log('🔍 Debugging Google Chat challenge notifications\n');
  console.log(`League slug: ${LEAGUE_SLUG}`);
  console.log(`App URL: ${APP_URL}\n`);

  try {
    // Step 1: Check if league exists
    console.log('1. Checking if league exists...');
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, slug')
      .eq('slug', LEAGUE_SLUG)
      .single();

    if (leagueError || !league) {
      console.error('❌ League not found:', leagueError?.message || 'League does not exist');
      return;
    }
    console.log(`✅ League found: ${league.name} (ID: ${league.id})\n`);

    // Step 2: Check chat integration configuration
    console.log('2. Checking chat integration configuration...');
    const { data: integration, error: integrationError } = await supabase
      .from('league_chat_integrations')
      .select('*')
      .eq('league_id', league.id)
      .single();

    if (integrationError || !integration) {
      console.error('❌ No chat integration configured for this league');
      console.log('📝 To fix this:');
      console.log('   1. Go to your league admin page');
      console.log('   2. Navigate to Chat Integration settings');
      console.log('   3. Configure a Google Chat webhook URL');
      console.log('   4. Enable challenge notifications');
      return;
    }

    console.log(`✅ Chat integration found:`);
    console.log(`   - Enabled: ${integration.enabled}`);
    console.log(`   - Challenge notifications: ${integration.notify_challenge_requests}`);
    console.log(`   - Webhook URL: ${integration.webhook_url.substring(0, 50)}...`);

    if (!integration.enabled) {
      console.error('❌ Chat integration is disabled');
      console.log('📝 To fix this: Enable chat integration in admin settings');
      return;
    }

    if (!integration.notify_challenge_requests) {
      console.error('❌ Challenge notifications are disabled');
      console.log('📝 To fix this: Enable challenge notifications in admin settings');
      return;
    }

    console.log('✅ Chat integration is properly configured\n');

    // Step 3: Test webhook URL format
    console.log('3. Validating webhook URL format...');
    if (!integration.webhook_url.startsWith('https://chat.googleapis.com/v1/spaces/')) {
      console.error('❌ Invalid webhook URL format');
      console.log('📝 Webhook URL should start with: https://chat.googleapis.com/v1/spaces/');
      return;
    }
    console.log('✅ Webhook URL format is valid\n');

    // Step 4: Test notification endpoint
    console.log('4. Testing challenge notification endpoint...');
    const testPayload = {
      challengerName: 'Test Challenger',
      challengedName: 'Test Opponent', 
      tournamentName: 'Test Tournament',
      leagueName: league.name,
      challengeId: 'test-challenge-id',
      appUrl: APP_URL
    };

    try {
      const response = await fetch(`${APP_URL}/api/leagues/${LEAGUE_SLUG}/chat-integration/notify-challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error(`❌ Notification endpoint failed (${response.status}):`, result.error);
        return;
      }

      console.log('✅ Notification endpoint responded successfully:', result.message || 'Success');
    } catch (fetchError) {
      console.error('❌ Failed to reach notification endpoint:', fetchError.message);
      console.log('📝 This could be due to:');
      console.log('   - Network connectivity issues');
      console.log('   - App URL configuration problems');
      console.log('   - Server not running or accessible');
      return;
    }

    console.log('\n🎉 All checks passed! Challenge notifications should be working.');
    console.log('\n📝 If you\'re still not receiving notifications, check:');
    console.log('   1. Google Chat space permissions');
    console.log('   2. Webhook URL is still valid (they can expire)');
    console.log('   3. Network firewall settings');
    console.log('   4. Server logs for any error messages');

    // Step 5: Show recent challenges
    console.log('\n5. Recent challenges in this league:');
    const { data: recentChallenges } = await supabase
      .from('tournament_challenges')
      .select(`
        *,
        tournament:tournament_id (name),
        challenger:challenger_participant_id (name),
        challenged:challenged_participant_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentChallenges && recentChallenges.length > 0) {
      recentChallenges.forEach((challenge, idx) => {
        console.log(`   ${idx + 1}. ${challenge.challenger?.name} challenged ${challenge.challenged?.name}`);
        console.log(`      Tournament: ${challenge.tournament?.name}`);
        console.log(`      Status: ${challenge.status}`);
        console.log(`      Created: ${new Date(challenge.created_at).toLocaleString()}`);
      });
    } else {
      console.log('   No recent challenges found');
    }

  } catch (error) {
    console.error('❌ Debug script error:', error.message);
  }
}

// Run the debug script
debugChallengeNotifications();
