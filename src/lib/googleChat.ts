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

export type { MatchNotificationData, ScheduleApprovalData }
