import { formatDateTimeWithTimezone, formatTimeWithTimezone, getDayBoundariesInUTC, getUserTimezone } from './timezone'

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
  timezone?: string
}

interface ScheduleApprovalData {
  leagueName: string
  player1Name: string
  player2Name: string
  scheduledAt: string
  leagueSlug: string
  appUrl: string
  timezone?: string
}

interface ScheduleRequestData {
  leagueName: string
  player1Name: string
  player2Name: string
  requestedByName: string
  proposedAt: string
  leagueSlug: string
  appUrl: string
  timezone?: string
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
  timezone?: string
}

interface DailySummaryData {
  leagueName: string
  leagueSlug: string
  appUrl: string
  timezone?: string
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
      console.log('Sending Google Chat message to webhook:', webhookUrl.substring(0, 50) + '...')
      console.log('Message payload:', JSON.stringify(message, null, 2))

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to read response')
        console.error('Google Chat webhook failed:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          webhookUrl: webhookUrl.substring(0, 50) + '...'
        })
        return false
      }

      console.log('Google Chat message sent successfully')
      return true
    } catch (error) {
      console.error('Failed to send Google Chat notification:', {
        error: error instanceof Error ? error.message : String(error),
        webhookUrl: webhookUrl.substring(0, 50) + '...',
        messageLength: JSON.stringify(message).length
      })
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
                content: formatDateTimeWithTimezone(data.scheduledAt, {
                  targetTimezone: data.timezone,
                  dateStyle: 'full',
                  timeStyle: 'short'
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
                content: formatDateTimeWithTimezone(data.scheduledAt, {
                  targetTimezone: data.timezone,
                  dateStyle: 'full',
                  timeStyle: 'short'
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

  static async notifyScheduleRequest(webhookUrl: string, data: ScheduleRequestData): Promise<boolean> {
    const card: GoogleChatCard = {
      header: {
        title: '📅 New Schedule Request',
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
                topLabel: 'Requested By',
                content: data.requestedByName,
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Proposed Time',
                content: formatDateTimeWithTimezone(data.proposedAt, {
                  targetTimezone: data.timezone,
                  dateStyle: 'full',
                  timeStyle: 'short'
                }),
                contentMultiline: false
              }
            },
            {
              textParagraph: {
                text: '⏰ A player has sent a schedule request for this match. The other player needs to approve or propose a different time.'
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
                content: formatDateTimeWithTimezone(data.completedAt, {
                  targetTimezone: data.timezone,
                  dateStyle: 'full',
                  timeStyle: 'short'
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

        // Get today's matches using proper timezone handling
        let todayMatches = [];
        if (options.includeSchedule) {
          const matchesResponse = await fetch(`${options.appUrl}/api/leagues/${options.leagueSlug}/upcoming`);
          if (matchesResponse.ok) {
            const matchesData = await matchesResponse.json();
            // Filter matches for today using UTC boundaries for Asia/Jakarta timezone
            const { startOfDayUTC, endOfDayUTC } = getDayBoundariesInUTC(new Date(), 'Asia/Jakarta');
            
            todayMatches = matchesData.matches.filter((match: any) => {
              if (!match.scheduled_at) return false;
              const matchDate = new Date(match.scheduled_at);
              return matchDate >= startOfDayUTC && matchDate <= endOfDayUTC;
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
              const timeStr = formatTimeWithTimezone(match.scheduled_at, 'Asia/Jakarta');
              
              return `🏓 <b>${match.player1.name}</b> vs <b>${match.player2.name}</b><br/>` +
                     `⏰ ${timeStr}`;
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
      const currentDate = formatDateTimeWithTimezone(new Date().toISOString(), {
        includeTime: false,
        targetTimezone: 'Asia/Jakarta',
        dateStyle: 'full'
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

  static async notifyDailySummaryWithData(webhookUrl: string, data: DailySummaryData): Promise<boolean> {
    const targetTimezone = data.timezone || 'Asia/Jakarta';
    const currentDate = formatDateTimeWithTimezone(new Date().toISOString(), {
      includeTime: false,
      targetTimezone,
      dateStyle: 'full'
    });

    const widgets: any[] = [
      {
        textParagraph: {
          text: `📊 Here's your daily league summary for <b>${currentDate}</b>`
        }
      }
    ]

    // Winning Streak Monster Section
    if (data.includeStreaks && data.winningStreakMonster) {
      const monster = data.winningStreakMonster
      widgets.push(
        {
          textParagraph: {
            text: `🔥 <b>Winning Streak Monster</b>`
          }
        },
        {
          keyValue: {
            topLabel: 'Player',
            content: monster.name,
            contentMultiline: false
          }
        },
        {
          keyValue: {
            topLabel: 'Current Streak',
            content: `${monster.streak} wins in a row!`,
            contentMultiline: false
          }
        },
        {
          keyValue: {
            topLabel: 'Overall Record',
            content: `${monster.wins}W-${monster.losses}L (${monster.winRate}% win rate)`,
            contentMultiline: false
          }
        }
      )
    } else if (data.includeStreaks) {
      widgets.push({
        textParagraph: {
          text: `🔥 <b>Winning Streak Monster</b>\nNo players currently have a winning streak of 3 or more.`
        }
      })
    }

    // Top Rankings Section
    if (data.includeRankings && data.topRankings && data.topRankings.length > 0) {
      widgets.push({
        textParagraph: {
          text: `🏆 <b>Current Top Rankings</b>`
        }
      })

      data.topRankings.forEach(player => {
        const rankEmoji = player.rank === 1 ? '👑' : player.rank === 2 ? '🥈' : '🥉'
        widgets.push({
          keyValue: {
            topLabel: `${rankEmoji} #${player.rank}`,
            content: `${player.name} - ${player.rating} ELO (${player.wins}W-${player.losses}L, ${player.points} pts)`,
            contentMultiline: false
          }
        })
      })
    } else if (data.includeRankings) {
      widgets.push({
        textParagraph: {
          text: `🏆 <b>Current Top Rankings</b>\nNo rankings available yet.`
        }
      })
    }

    // Today's Schedule Section
    if (data.includeSchedule && data.todayMatches && data.todayMatches.length > 0) {
      widgets.push({
        textParagraph: {
          text: `📅 <b>Today's Match Schedule</b>`
        }
      })

      data.todayMatches.forEach(match => {
        const time = formatTimeWithTimezone(match.scheduledAt, targetTimezone);
        widgets.push({
          keyValue: {
            topLabel: `${time}`,
            content: `${match.player1Name} vs ${match.player2Name}`,
            contentMultiline: false
          }
        })
      })
    } else if (data.includeSchedule) {
      widgets.push({
        textParagraph: {
          text: `📅 <b>Today's Match Schedule</b>\nNo matches scheduled for today.`
        }
      })
    }

    // Add view league button
    widgets.push({
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
    })

    const card: GoogleChatCard = {
      header: {
        title: '📊 Daily League Summary',
        subtitle: data.leagueName,
      },
      sections: [
        {
          widgets: widgets
        }
      ]
    }

    const message: GoogleChatMessage = {
      cards: [card]
    }

    return this.sendMessage(webhookUrl, message)
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

  static async sendCustomAnnouncement(
    webhookUrl: string, 
    leagueName: string, 
    announcementText: string, 
    leagueSlug: string, 
    appUrl: string,
    timezone: string = 'Asia/Jakarta'
  ): Promise<boolean> {
    const currentTime = formatDateTimeWithTimezone(new Date().toISOString(), {
      targetTimezone: timezone,
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const card: GoogleChatCard = {
      header: {
        title: '📢 League Announcement',
        subtitle: leagueName,
      },
      sections: [
        {
          widgets: [
            {
              textParagraph: {
                text: announcementText
              }
            },
            {
              keyValue: {
                topLabel: 'Posted',
                content: currentTime,
                contentMultiline: false
              }
            },
            {
              buttons: [
                {
                  textButton: {
                    text: 'View League',
                    onClick: {
                      openLink: {
                        url: `${appUrl}/${leagueSlug}`
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

  static async notifyNewChallenge(
    webhookUrl: string,
    challengerName: string,
    challengedName: string,
    tournamentName: string,
    leagueName: string,
    leagueSlug: string,
    appUrl: string,
    timezone: string = 'Asia/Jakarta'
  ): Promise<boolean> {
    const challengeUrl = `${appUrl}/${leagueSlug}`
    
    const card: GoogleChatCard = {
      header: {
        title: '🏆 New Challenge Request',
        subtitle: leagueName,
      },
      sections: [
        {
          widgets: [
            {
              textParagraph: {
                text: `**${challengerName}** has challenged **${challengedName}** in **${tournamentName}**!\n\nThis exciting match is waiting to be scheduled. Don't miss the action!`
              }
            },
            {
              keyValue: {
                topLabel: 'Challenger',
                content: challengerName,
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Challenged',
                content: challengedName,
                contentMultiline: false
              }
            },
            {
              keyValue: {
                topLabel: 'Tournament',
                content: tournamentName,
                contentMultiline: false
              }
            },
            {
              buttons: [
                {
                  textButton: {
                    text: 'View this challenge on app',
                    onClick: {
                      openLink: {
                        url: challengeUrl
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
}

export type { MatchNotificationData, ScheduleApprovalData, ScheduleRequestData, MatchCompletionData, DailySummaryData }
