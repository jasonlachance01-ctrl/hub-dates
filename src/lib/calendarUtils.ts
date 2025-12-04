import { EventType } from "@/types";
import { parse } from "date-fns";

/**
 * Escapes special characters in iCalendar text fields per RFC 5545
 */
const escapeICalText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/\n/g, '\\n');  // Escape newlines
};

/**
 * Sanitizes filename by removing invalid characters
 */
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[/\\:*?"<>|]/g, '-')  // Replace invalid filename chars
    .replace(/\s+/g, '-')            // Replace spaces
    .replace(/-+/g, '-')             // Remove duplicate dashes
    .replace(/^-|-$/g, '');          // Trim dashes from start/end
};

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

    // Parse date string safely to avoid timezone issues
    // Dates are stored as "August 25, 2025" or "August 25th, 2025"
    const cleanedDate = event.date.replace(/(\d+)(st|nd|rd|th)/i, "$1");
    let eventDate: Date;
    
    try {
      // Try parsing as spelled-out date first (e.g., "August 25, 2025")
      eventDate = parse(cleanedDate, "MMMM d, yyyy", new Date());
      
      // Validate parsed date
      if (isNaN(eventDate.getTime())) {
        // Fallback: try M/d/yyyy format (e.g., "8/25/2025")
        eventDate = parse(event.date, "M/d/yyyy", new Date());
      }
      
      if (isNaN(eventDate.getTime())) {
        console.warn(`Skipping event with invalid date: ${event.name} - ${event.date}`);
        return;
      }
    } catch (error) {
      console.warn(`Failed to parse date for event: ${event.name} - ${event.date}`, error);
      return;
    }
    
    const eventName = organizationName ? `${organizationName} ${event.name}` : event.name;
    
    // Extract date components directly to avoid timezone issues
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // For all-day events, DTEND must be the day after (non-inclusive)
    const endDate = new Date(year, eventDate.getMonth(), eventDate.getDate() + 1);
    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDate.getDate()).padStart(2, '0');
    const endDateStr = `${endYear}${endMonth}${endDay}`;
    
    // Generate a unique ID for the event (sanitized)
    const sanitizedOrgName = sanitizeFilename(organizationName);
    const uid = `${event.id}-${sanitizedOrgName}@academiccalendar.app`;
    
    // Escape special characters per RFC 5545
    const escapedSummary = escapeICalText(eventName);
    const escapedDescription = escapeICalText(eventName);
    
    // DTSTAMP is REQUIRED by RFC 5545 - timestamp when event was created
    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${endDateStr}`,
      `SUMMARY:${escapedSummary}`,
      `DESCRIPTION:${escapedDescription}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
};

/**
 * Downloads .ics file and triggers native calendar app to open
 * On iOS/mobile: Automatically opens in default calendar app
 * User just needs to tap "Add" or "Save" to sync events
 */
export const downloadICalendarFile = (
  organizationName: string,
  icsContent: string
): void => {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${sanitizeFilename(organizationName)}-calendar.ics`;
  
  // Append to body, click, then cleanup
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Delay cleanup to ensure download completes and calendar app can open
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
};
