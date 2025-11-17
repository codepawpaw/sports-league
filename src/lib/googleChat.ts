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

  static async notifyDailySummary(webhookUrl: string, data: DailySummaryData): Promise<boolean> {
    const currentDate = new Date().toLocaleDateString('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

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
        const time = new Date(match.scheduledAt).toLocaleTimeString('en-US', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit'
        })
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
}

export type { MatchNotificationData, ScheduleApprovalData, MatchCompletionData, DailySummaryData }
