'use client'

import { useEffect, useState } from 'react'
import { formatDateTimeWithTimezone, formatTimeWithTimezone, formatDateOnly, getUserTimezone } from '@/lib/timezone'

interface DateTimeDisplayProps {
  utcDateTime: string | null
  format?: 'full' | 'time-only' | 'date-only' | 'short'
  targetTimezone?: string
  className?: string
}

export default function DateTimeDisplay({
  utcDateTime,
  format = 'full',
  targetTimezone,
  className = ''
}: DateTimeDisplayProps) {
  const [formattedDate, setFormattedDate] = useState<string>('Loading...')
  const [timezone, setTimezone] = useState<string>('UTC')

  useEffect(() => {
    if (!utcDateTime) {
      setFormattedDate('Not scheduled')
      return
    }

    try {
      const userTimezone = targetTimezone || getUserTimezone().timezone
      setTimezone(getUserTimezone().abbreviation)

      let formatted: string
      switch (format) {
        case 'time-only':
          formatted = formatTimeWithTimezone(utcDateTime, userTimezone)
          break
        case 'date-only':
          formatted = formatDateOnly(utcDateTime, userTimezone)
          break
        case 'short':
          formatted = formatDateTimeWithTimezone(utcDateTime, {
            targetTimezone: userTimezone,
            dateStyle: 'short',
            timeStyle: 'short'
          })
          break
        case 'full':
        default:
          formatted = formatDateTimeWithTimezone(utcDateTime, {
            targetTimezone: userTimezone,
            dateStyle: 'medium',
            timeStyle: 'short'
          })
          break
      }
      setFormattedDate(formatted)
    } catch (error) {
      console.error('Error formatting date:', error)
      setFormattedDate('Invalid date')
    }
  }, [utcDateTime, format, targetTimezone])

  if (!utcDateTime) {
    return <span className={className}>Not scheduled</span>
  }

  return (
    <span 
      className={className}
      title={`UTC: ${new Date(utcDateTime).toISOString()}`}
    >
      {formattedDate}
    </span>
  )
}

// Specialized components for common use cases
export function MatchScheduleTime({ 
  scheduledAt, 
  className = '' 
}: { 
  scheduledAt: string | null
  className?: string 
}) {
  return (
    <DateTimeDisplay 
      utcDateTime={scheduledAt} 
      format="full" 
      className={className}
    />
  )
}

export function MatchTime({ 
  scheduledAt, 
  className = '' 
}: { 
  scheduledAt: string | null
  className?: string 
}) {
  return (
    <DateTimeDisplay 
      utcDateTime={scheduledAt} 
      format="time-only" 
      className={className}
    />
  )
}

export function MatchDate({ 
  scheduledAt, 
  className = '' 
}: { 
  scheduledAt: string | null
  className?: string 
}) {
  return (
    <DateTimeDisplay 
      utcDateTime={scheduledAt} 
      format="date-only" 
      className={className}
    />
  )
}

export function CompletedTime({ 
  completedAt, 
  className = '' 
}: { 
  completedAt: string | null
  className?: string 
}) {
  return (
    <DateTimeDisplay 
      utcDateTime={completedAt} 
      format="full" 
      className={className}
    />
  )
}

// Hook for getting formatted date strings (useful for non-component usage)
export function useFormattedDateTime(
  utcDateTime: string | null,
  format: 'full' | 'time-only' | 'date-only' | 'short' = 'full',
  targetTimezone?: string
) {
  const [formattedDate, setFormattedDate] = useState<string>('Loading...')

  useEffect(() => {
    if (!utcDateTime) {
      setFormattedDate('Not scheduled')
      return
    }

    try {
      const userTimezone = targetTimezone || getUserTimezone().timezone

      let formatted: string
      switch (format) {
        case 'time-only':
          formatted = formatTimeWithTimezone(utcDateTime, userTimezone)
          break
        case 'date-only':
          formatted = formatDateOnly(utcDateTime, userTimezone)
          break
        case 'short':
          formatted = formatDateTimeWithTimezone(utcDateTime, {
            targetTimezone: userTimezone,
            dateStyle: 'short',
            timeStyle: 'short'
          })
          break
        case 'full':
        default:
          formatted = formatDateTimeWithTimezone(utcDateTime, {
            targetTimezone: userTimezone,
            dateStyle: 'medium',
            timeStyle: 'short'
          })
          break
      }
      setFormattedDate(formatted)
    } catch (error) {
      console.error('Error formatting date:', error)
      setFormattedDate('Invalid date')
    }
  }, [utcDateTime, format, targetTimezone])

  return formattedDate
}
