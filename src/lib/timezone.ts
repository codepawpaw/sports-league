/**
 * Centralized timezone utility functions for the ping-pong league application
 * Handles conversion between UTC (for database storage) and local timezones (for display)
 */

export interface TimezoneInfo {
  timezone: string;
  offset: number; // in minutes
  abbreviation: string;
}

/**
 * Get user's timezone information from the browser
 */
export function getUserTimezone(): TimezoneInfo {
  if (typeof window === 'undefined') {
    // Server-side fallback to UTC
    return {
      timezone: 'UTC',
      offset: 0,
      abbreviation: 'UTC'
    };
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = new Date();
  const offset = -date.getTimezoneOffset(); // Convert to positive offset in minutes
  
  // Get timezone abbreviation
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'short'
  });
  const parts = formatter.formatToParts(date);
  const abbreviation = parts.find(part => part.type === 'timeZoneName')?.value || 'Local';

  return {
    timezone,
    offset,
    abbreviation
  };
}

/**
 * Convert a local date/time to UTC for database storage
 * @param localDateTime - Date string or Date object in local timezone
 * @param userTimezone - Optional timezone, defaults to user's browser timezone
 * @returns ISO string in UTC
 */
export function convertLocalToUTC(
  localDateTime: string | Date,
  userTimezone?: string
): string {
  const date = new Date(localDateTime);
  
  if (userTimezone && typeof window !== 'undefined') {
    // If specific timezone is provided, adjust accordingly
    const targetDate = new Date(date.toLocaleString('en-US', { timeZone: userTimezone }));
    const localDate = new Date(date.toLocaleString('en-US'));
    const diff = localDate.getTime() - targetDate.getTime();
    return new Date(date.getTime() + diff).toISOString();
  }
  
  return date.toISOString();
}

/**
 * Convert UTC datetime to local timezone for display
 * @param utcDateTime - UTC datetime string
 * @param targetTimezone - Target timezone (defaults to user's browser timezone)
 * @returns Date object in local timezone
 */
export function convertUTCToLocal(
  utcDateTime: string | null,
  targetTimezone?: string
): Date | null {
  if (!utcDateTime) return null;
  
  const utcDate = new Date(utcDateTime);
  
  if (targetTimezone && typeof window !== 'undefined') {
    // Convert to specific timezone
    const localString = utcDate.toLocaleString('en-CA', { 
      timeZone: targetTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return new Date(localString.replace(',', ''));
  }
  
  // Default to browser's timezone
  return new Date(utcDate.toLocaleString());
}

/**
 * Format a UTC datetime for display with timezone info
 * @param utcDateTime - UTC datetime string
 * @param options - Formatting options
 * @returns Formatted string with timezone
 */
export function formatDateTimeWithTimezone(
  utcDateTime: string | null,
  options: {
    includeDate?: boolean;
    includeTime?: boolean;
    includeTimezone?: boolean;
    targetTimezone?: string;
    dateStyle?: 'short' | 'medium' | 'long' | 'full';
    timeStyle?: 'short' | 'medium' | 'long';
  } = {}
): string {
  if (!utcDateTime) return 'Not scheduled';

  const {
    includeDate = true,
    includeTime = true,
    includeTimezone = true,
    targetTimezone,
    dateStyle = 'medium',
    timeStyle = 'short'
  } = options;

  const utcDate = new Date(utcDateTime);
  const timezone = targetTimezone || getUserTimezone().timezone;

  let formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone
  };

  if (includeDate && includeTime) {
    formatOptions = {
      ...formatOptions,
      dateStyle,
      timeStyle
    };
  } else if (includeDate) {
    formatOptions = {
      ...formatOptions,
      dateStyle
    };
  } else if (includeTime) {
    formatOptions = {
      ...formatOptions,
      timeStyle
    };
  }

  let formatted = utcDate.toLocaleString('en-US', formatOptions);

  if (includeTimezone) {
    const tzAbbr = getTimezoneAbbreviation(timezone);
    formatted += ` ${tzAbbr}`;
  }

  return formatted;
}

/**
 * Get timezone abbreviation for a given timezone
 */
export function getTimezoneAbbreviation(timezone: string): string {
  if (typeof window === 'undefined') return 'UTC';
  
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find(part => part.type === 'timeZoneName')?.value || 'Local';
  } catch {
    return 'Local';
  }
}

/**
 * Format time only with timezone
 */
export function formatTimeWithTimezone(
  utcDateTime: string | null,
  targetTimezone?: string
): string {
  return formatDateTimeWithTimezone(utcDateTime, {
    includeDate: false,
    includeTime: true,
    includeTimezone: true,
    targetTimezone,
    timeStyle: 'short'
  });
}

/**
 * Format date only
 */
export function formatDateOnly(
  utcDateTime: string | null,
  targetTimezone?: string
): string {
  return formatDateTimeWithTimezone(utcDateTime, {
    includeDate: true,
    includeTime: false,
    includeTimezone: false,
    targetTimezone,
    dateStyle: 'medium'
  });
}

/**
 * Get start and end of day in UTC for a given local date
 * Useful for database queries that need to filter by local "today"
 */
export function getDayBoundariesInUTC(
  localDate: Date | string = new Date(),
  userTimezone?: string
): { startOfDayUTC: Date; endOfDayUTC: Date } {
  const date = new Date(localDate);
  const timezone = userTimezone || getUserTimezone().timezone;

  // Get start of day in user's timezone
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Create date in user's timezone at start of day
  const startOfDayLocal = new Date();
  startOfDayLocal.setFullYear(year, month, day);
  startOfDayLocal.setHours(0, 0, 0, 0);

  const endOfDayLocal = new Date(startOfDayLocal);
  endOfDayLocal.setHours(23, 59, 59, 999);

  // Convert to UTC
  const startOfDayUTC = new Date(convertLocalToUTC(startOfDayLocal, timezone));
  const endOfDayUTC = new Date(convertLocalToUTC(endOfDayLocal, timezone));

  return { startOfDayUTC, endOfDayUTC };
}

/**
 * Check if a UTC datetime falls within today in user's timezone
 */
export function isToday(utcDateTime: string, userTimezone?: string): boolean {
  const { startOfDayUTC, endOfDayUTC } = getDayBoundariesInUTC(new Date(), userTimezone);
  const date = new Date(utcDateTime);
  
  return date >= startOfDayUTC && date <= endOfDayUTC;
}

/**
 * Convert HTML datetime-local input value to UTC
 * This is specifically for form inputs that use datetime-local type
 */
export function convertDateTimeLocalToUTC(
  dateTimeLocalValue: string,
  userTimezone?: string
): string {
  // datetime-local format is YYYY-MM-DDTHH:mm
  if (!dateTimeLocalValue) throw new Error('DateTime value is required');
  
  // Add seconds if not present
  const fullDateTime = dateTimeLocalValue.includes(':') && 
    dateTimeLocalValue.split(':').length === 2 
    ? `${dateTimeLocalValue}:00` 
    : dateTimeLocalValue;
  
  return convertLocalToUTC(fullDateTime, userTimezone);
}

/**
 * Convert UTC datetime to HTML datetime-local input format
 */
export function convertUTCToDateTimeLocal(
  utcDateTime: string | null,
  userTimezone?: string
): string {
  if (!utcDateTime) return '';
  
  const localDate = convertUTCToLocal(utcDateTime, userTimezone);
  if (!localDate) return '';
  
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
