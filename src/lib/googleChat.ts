interface GoogleChatCard {
  header?: {
    title: string
    subtitle?: string
    imageUrl?: string
  }
  sections: Array<{
    widgets: Array<{
      textParagraph?: {
        text: string
      }
      keyValue?: {
        topLabel: string
        content: string
        contentMultiline?: boolean
      }
      buttons?: Array<{
        textButton: {
          text: string
          onClick: {
            openLink: {
              url: string
            }
          }
        }
      }>
    }>
  }>
}

interface GoogleChatMessage {
  text?: string
  cards?: GoogleChatCard[]
}

interface MatchNotificationData {
  leagueName: string
  seasonName?: string
  player1Name: string
  player2Name: string
  scheduledAt?: string
  leagueSlug: string
  appUrl: string
}

interface ScheduleApprovalData {
  leagueName: string
  player1Name: string
  player2Name: string
  scheduledAt: string
  leagueSlug: string
  appUrl: string
}

interface MatchCompletionData {
  leagueName: string
  seasonName?: string
  player1Name: string
  player2Name: string
  player1Score: number
  player2Score: number
  winnerName: string
  completedAt: string
  leagueSlug: string
  appUrl: string
}

interface DailySummaryData {
  leagueName: string
  leagueSlug: string
  appUrl: string
  winningStreakMonster?: {
    name: string
    streak: number
    wins: number
    losses: number
    winRate: number
  }
  topRankings?: Array<{
    rank: number
    name: string
    rating: number
    wins: number
    losses: number
    points: number
  }>
  todayMatches?: Array<{
    player1Name: string
    player2Name: string
    scheduledAt: string
    status: string
  }>
  includeStreaks: boolean
  includeRankings: boolean
  includeSchedule: boolean
}

export class GoogleChatNotifier {
  private static async sendMessage(webhookUrl: string, message: GoogleChatMessage): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        console.error('Google Chat webhook failed:', response.status, response.statusText)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to send Google Chat notification:', error)
      return false
    }
  }

  static async notifyNewMatch(webhookUrl: string, data: MatchNotificationData): Promise<boolean> {
    const card: GoogleChatCard = {
      header: {
        title: '🏓 New Match Created',
        subtitle: data.leagueName,
      },
      sections: [
        {
          widgets: [
            {
              keyValue: {
                topLabel: 'Match',
                content: `${data.player1Name} vs ${data.player2Name}`,
                contentMultiline: false
              }
            },
            ...(data.seasonName ? [{
              keyValue: {
                topLabel: 'Season',
                content: data.seasonName,
                contentMultiline: false
              }
            }] : []),
            ...(data.scheduledAt ? [{
              keyValue: {
                topLabel: 'Scheduled',
                content: new Date(data.scheduledAt).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                contentMultiline: false
              }
            }] : [{
              keyValue: {
                topLabel: 'Status',
                content: 'Awaiting schedule confirmation',
                contentMultiline: false
              }
            }]),
            {
              buttons: [
                {
                  textButton: {
                    text: 'View League',
                    onClick: {
                      openLink: {
                        url: `${data.appUrl}/${data.leagueSlug}`
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    const message: GoogleChatMessage = {
      cards: [card]
    }

    return this.sendMessage(webhookUrl, message)
  }

  static async notifyScheduleApproved(webhookUrl: string, data: ScheduleApprovalData): Promise<boolean> {
    const card: GoogleChatCard = {
      header: {
        title: '✅ Match Schedule Confirmed',
        subtitle: data.leagueName,
      },
      sections: [
        {
          widgets: [
            {
              keyValue: {
                topLabel: 'Match',
                content: `${data.player1Name} vs ${data.player2Name}`,
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Scheduled',
                content: new Date(data.scheduledAt).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                contentMultiline: false
              }
            },
            {
              textParagraph: {
                text: '🎾 The match time has been confirmed by both players!'
              }
            },
            {
              buttons: [
                {
                  textButton: {
                    text: 'View League',
                    onClick: {
                      openLink: {
                        url: `${data.appUrl}/${data.leagueSlug}`
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    const message: GoogleChatMessage = {
      cards: [card]
    }

    return this.sendMessage(webhookUrl, message)
  }

  static async notifyMatchCompleted(webhookUrl: string, data: MatchCompletionData): Promise<boolean> {
    const isDraw = data.player1Score === data.player2Score
    const scoreDisplay = `${data.player1Score} - ${data.player2Score}`
    
    const card: GoogleChatCard = {
      header: {
        title: '🏆 Match Completed',
        subtitle: data.leagueName,
      },
      sections: [
        {
          widgets: [
            {
              keyValue: {
                topLabel: 'Match',
                content: `${data.player1Name} vs ${data.player2Name}`,
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Final Score',
                content: scoreDisplay,
                contentMultiline: false
              }
            },
            ...(data.seasonName ? [{
              keyValue: {
                topLabel: 'Season',
                content: data.seasonName,
                contentMultiline: false
              }
            }] : []),
            {
              keyValue: {
                topLabel: 'Result',
                content: isDraw ? '🤝 Draw!' : `🎉 ${data.winnerName} wins!`,
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Completed',
                content: new Date(data.completedAt).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                contentMultiline: false
              }
            },
            {
              textParagraph: {
                text: isDraw 
                  ? '⚖️ What an intense match! Both players showed excellent skills.'
                  : `🏓 Congratulations to <b>${data.winnerName}</b> for the victory!`
              }
            },
            {
              buttons: [
                {
                  textButton: {
                    text: 'View League',
                    onClick: {
                      openLink: {
                        url: `${data.appUrl}/${data.leagueSlug}`
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    const message: GoogleChatMessage = {
      cards: [card]
    }

    return this.sendMessage(webhookUrl, message)
  }

  static async notifyDailySummary(
    webhookUrl: string,
    options: {
      leagueName: string;
      seasonName?: string;
      includeStreaks?: boolean;
      includeRankings?: boolean;
      includeSchedule?: boolean;
      leagueSlug: string;
      appUrl: string;
    }
  ) {
    try {
      let sections = [];

      // Fetch data if any section is requested
      if (options.includeStreaks || options.includeRankings || options.includeSchedule) {
        // Get players data using the same API endpoint as the frontend
        const playersResponse = await fetch(`${options.appUrl}/api/leagues/${options.leagueSlug}/players`);
        let playersData = null;
        if (playersResponse.ok) {
          playersData = await playersResponse.json();
        }

        // Get today's matches
        let todayMatches = [];
        if (options.includeSchedule) {
          // Get today's date in WIB (UTC+7)
          const now = new Date();
          const wibOffset = 7 * 60; // WIB is UTC+7
          const wibTime = new Date(now.getTime() + (wibOffset * 60000));
          const today = wibTime.toISOString().split('T')[0]; // YYYY-MM-DD format

          const matchesResponse = await fetch(`${options.appUrl}/api/leagues/${options.leagueSlug}/upcoming`);
          if (matchesResponse.ok) {
            const matchesData = await matchesResponse.json();
            todayMatches = matchesData.matches.filter((match: any) => {
              if (!match.scheduled_at) return false;
              const matchDate = new Date(match.scheduled_at);
              const matchWibDate = new Date(matchDate.getTime() + (wibOffset * 60000));
              return matchWibDate.toISOString().split('T')[0] === today;
            });
          }
        }

        // Build sections
        if (options.includeStreaks && playersData?.players) {
          // Use exact same logic as TopPlayersBanner component
          const streakMonster = playersData.players
            .filter((player: any) => player.winning_streak >= 3)
            .sort((a: any, b: any) => b.winning_streak - a.winning_streak)[0];

          if (streakMonster) {
            const totalMatches = streakMonster.wins + streakMonster.losses;
            const winRate = totalMatches > 0 ? Math.round((streakMonster.wins / totalMatches) * 100) : 0;
            
            sections.push({
              header: "🔥 *Winning Streak Monster*",
              widgets: [{
                textParagraph: {
                  text: `<b>${streakMonster.name}</b><br/>` +
                        `🏆 <b>${streakMonster.winning_streak} wins in a row!</b><br/>` +
                        `📊 ${streakMonster.wins}W-${streakMonster.losses}L (${winRate}% win rate)<br/>` +
                        `⭐ ${Math.round(streakMonster.current_rating || 1200)} ELO${streakMonster.is_provisional ? ' (Provisional)' : ''}`
                }
              }]
            });
          } else {
            sections.push({
              header: "🔥 *Winning Streak Monster*",
              widgets: [{
                textParagraph: {
                  text: "No player currently has a winning streak of 3+ matches."
                }
              }]
            });
          }
        }

        if (options.includeRankings && playersData?.players) {
          // Use exact same logic as frontend - players are already sorted by the API
          const top3 = playersData.players.slice(0, 3);
          if (top3.length > 0) {
            const rankingText = top3.map((player: any, index: number) => {
              const totalMatches = player.wins + player.losses;
              const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;
              const medals = ['🥇', '🥈', '🥉'];
              
              return `${medals[index]} <b>#${index + 1} ${player.name}</b><br/>` +
                     `⭐ ${Math.round(player.current_rating || 1200)} ELO${player.is_provisional ? ' (Provisional)' : ''}<br/>` +
                     `📊 ${player.wins}W-${player.losses}L (${winRate}% win rate) | ${player.points} pts<br/>` +
                     `🎯 Sets: ${player.sets_won}W-${player.sets_lost}L (${player.set_diff >= 0 ? '+' : ''}${player.set_diff})`;
            }).join('<br/><br/>');

            sections.push({
              header: "🏆 *Current Top 3*",
              widgets: [{
                textParagraph: {
                  text: rankingText
                }
              }]
            });
          } else {
            sections.push({
              header: "🏆 *Current Top 3*",
              widgets: [{
                textParagraph: {
                  text: "No rankings available yet."
                }
              }]
            });
          }
        }

        if (options.includeSchedule) {
          if (todayMatches.length > 0) {
            const scheduleText = todayMatches.map((match: any) => {
              const matchTime = new Date(match.scheduled_at);
              // Convert to WIB
              const wibTime = new Date(matchTime.getTime() + (7 * 60 * 60 * 1000));
              const timeStr = wibTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'UTC'
              });
              
              return `🏓 <b>${match.player1.name}</b> vs <b>${match.player2.name}</b><br/>` +
                     `⏰ ${timeStr} WIB`;
            }).join('<br/><br/>');

            sections.push({
              header: "📅 *Today's Match Schedule*",
              widgets: [{
                textParagraph: {
                  text: scheduleText
                }
              }]
            });
          } else {
            sections.push({
              header: "📅 *Today's Match Schedule*",
              widgets: [{
                textParagraph: {
                  text: "No matches scheduled for today."
                }
              }]
            });
          }
        }
      }

      // Build the complete message
      const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Jakarta'
      });

      const message = {
        cardsV2: [{
          cardId: 'daily-summary',
          card: {
            header: {
              title: `📊 Daily League Summary`,
              subtitle: `${options.leagueName}${options.seasonName ? ` - ${options.seasonName}` : ''} | ${currentDate}`,
              imageUrl: "https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
            },
            sections: sections
          }
        }]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error sending daily summary to Google Chat:', error);
      throw error;
    }
  }

  static async testNotification(webhookUrl: string, leagueName: string): Promise<boolean> {
    const card: GoogleChatCard = {
      header: {
        title: '🔔 Test Notification',
        subtitle: 'Ping Pong League System',
      },
      sections: [
        {
          widgets: [
            {
              textParagraph: {
                text: `✅ Google Chat integration is working correctly for <b>${leagueName}</b>!`
              }
            },
            {
              keyValue: {
                topLabel: 'Status',
                content: 'Integration Active',
                contentMultiline: false
              }
            }
          ]
        }
      ]
    }

    const message: GoogleChatMessage = {
      cards: [card]
    }

    return this.sendMessage(webhookUrl, message)
  }
}

export type { MatchNotificationData, ScheduleApprovalData, MatchCompletionData, DailySummaryData }
