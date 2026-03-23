import { EventType } from "@/types";
import { parse } from "date-fns";

/* ─── Types used by the platform picker ─── */
interface EventGroup {
  orgName: string;
  events: EventType[];
}

/* ─── Helper: simple string hash for unique IDs ─── */
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

/* ─── Helper: parse an event date string → date parts ─── */
const parseDateParts = (
  dateStr: string | undefined
): { start: string; end: string; isoStart: string; isoEnd: string } | null => {
  if (!dateStr) return null;

  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, "$1");

  let d: Date | null = null;

  const formats = [
    "MMMM d, yyyy",
    "MMM d, yyyy",
    "MMMM d yyyy",
    "MMM d yyyy",
    "M/d/yyyy",
    "MM/dd/yyyy",
    "yyyy-MM-dd",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(cleaned, fmt, new Date());
      if (!isNaN(parsed.getTime())) {
        d = parsed;
        break;
      }
    } catch {
      // try next format
    }
  }

  // Handle date ranges like "October 14 - 18, 2025"
  if (!d) {
    const rangeMatch = cleaned.match(
      /^(\w+)\s+(\d{1,2})\s*[-–]\s*\d{1,2},?\s+(\d{4})/
    );
    if (rangeMatch) {
      const rangeStr = `${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[3]}`;
      try {
        const parsed = parse(rangeStr, "MMMM d, yyyy", new Date());
        if (!isNaN(parsed.getTime())) d = parsed;
      } catch { /* ignore */ }
      if (!d) {
        try {
          const parsed = parse(rangeStr, "MMM d, yyyy", new Date());
          if (!isNaN(parsed.getTime())) d = parsed;
        } catch { /* ignore */ }
      }
    }
  }

  // Last resort: native Date constructor
  if (!d) {
    try {
      const native = new Date(cleaned);
      if (!isNaN(native.getTime())) d = native;
    } catch { /* ignore */ }
  }

  if (!d) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const next = new Date(y, d.getMonth(), d.getDate() + 1);
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, "0");
  const nd = String(next.getDate()).padStart(2, "0");
  return {
    start: `${y}${m}${day}`,
    end: `${ny}${nm}${nd}`,
    isoStart: `${y}-${m}-${day}`,
    isoEnd: `${ny}-${nm}-${nd}`,
  };
};

export const generateGoogleCalendarUrls = (groups: EventGroup[]): string[] => {
  const urls: string[] = [];
  groups.forEach(({ orgName, events }) => {
    events.forEach((ev) => {
      const parts = parseDateParts(ev.date);
      if (!parts) return;
      const title = orgName ? `${orgName} - ${ev.name}` : ev.name;
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: title,
        dates: `${parts.start}/${parts.end}`,
        details: `Added via AcademicAnnual.com`,
      });
      urls.push(`https://calendar.google.com/calendar/render?${params.toString()}`);
    });
  });
  return urls;
};

export const generateOutlookCalendarUrls = (groups: EventGroup[]): string[] => {
  const urls: string[] = [];
  groups.forEach(({ orgName, events }) => {
    events.forEach((ev) => {
      const parts = parseDateParts(ev.date);
      if (!parts) return;
      const title = orgName ? `${orgName} - ${ev.name}` : ev.name;
      const params = new URLSearchParams({
        rru: "addevent",
        startdt: parts.isoStart,
        enddt: parts.isoEnd,
        subject: title,
        allday: "true",
        body: "Added via AcademicAnnual.com",
      });
      urls.push(`https://outlook.live.com/calendar/0/action/compose?${params.toString()}`);
    });
  });
  return urls;
};

const escapeICalText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
};

const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

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

  let skippedCount = 0;

  events.forEach(event => {
    if (!event.date) {
      skippedCount++;
      return;
    }

    const parts = parseDateParts(event.date);
    if (!parts) {
      console.warn(`[AcademicAnnual] Skipping event with unparseable date: "${event.name}" — "${event.date}"`);
      skippedCount++;
      return;
    }

    const eventName = organizationName
      ? `${organizationName} ${event.name}`
      : event.name;

    // UID must be unique across all schools — use hash of full name + date
    const uid = `aa-${simpleHash(eventName + parts.start)}-${event.id}@academiccalendar.app`;

    const escapedSummary = escapeICalText(eventName);
    const escapedDescription = escapeICalText(eventName);

    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${parts.start}`,
      `DTEND;VALUE=DATE:${parts.end}`,
      `SUMMARY:${escapedSummary}`,
      `DESCRIPTION:${escapedDescription}`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  if (skippedCount > 0) {
    console.warn(`[AcademicAnnual] ${skippedCount} event(s) skipped due to missing or unparseable dates.`);
  }

  return lines.join('\r\n');
};

export const downloadICalendarFile = async (
  organizationName: string,
  icsContent: string
): Promise<void> => {
  const filename = `${sanitizeFilename(organizationName)}-calendar.ics`;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

  // iOS non-Safari: use Web Share API so user can tap "Calendar" in share sheet
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

  if (isIOS && !isSafari) {
    try {
      const file = new File([blob], filename, { type: 'text/calendar' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: organizationName || 'School Calendar' });
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      console.warn('Web Share API failed, falling back to download:', err);
    }
  }

  // Safari & desktop: traditional blob download
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};
