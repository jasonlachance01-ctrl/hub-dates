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
    
    // Generate a unique ID for the event
    const uid = `${event.id}-${organizationName.replace(/\s+/g, '-')}@academiccalendar.app`;
    
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${dateStr}`,
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
 * Triggers download of an .ics file
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
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
};
