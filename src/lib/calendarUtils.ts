import { EventType } from "@/types";

/**
 * Generates an iCalendar (.ics) file content for the given events
 */
export const generateICalendarFile = (
  organizationName: string,
  events: EventType[]
): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Academic Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach(event => {
    if (!event.date) return; // Skip events without dates

    const eventDate = new Date(event.date);
    const eventName = `${organizationName} ${event.name}`;
    
    // Format date as YYYYMMDD for all-day events
    const dateStr = eventDate.toISOString().split('T')[0].replace(/-/g, '');
    
    // For all-day events, DTEND must be the day after (non-inclusive)
    const endDate = new Date(eventDate);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
    
    // Generate a unique ID for the event
    const uid = `${event.id}-${organizationName.replace(/\s+/g, '-')}@academiccalendar.app`;
    
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${endDateStr}`,
      `SUMMARY:${eventName}`,
      `DESCRIPTION:${eventName}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
};

/**
 * Triggers automatic opening of .ics file (opens calendar app directly)
 * On mobile: Downloads and automatically prompts to open in calendar app
 * On desktop: Downloads file which user can open
 */
export const downloadICalendarFile = (
  organizationName: string,
  icsContent: string
): void => {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${organizationName.replace(/\s+/g, '-')}-calendar.ics`;
  
  // Append to body, click, then cleanup
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup the blob URL
  window.URL.revokeObjectURL(url);
};
