export interface EventType {
  id: string;
  name: string;
  date?: string;
  addedToCalendar?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  url?: string;
  events: EventType[];
}

export const DEFAULT_EVENT_TYPES: Omit<EventType, "selected" | "addedToCalendar">[] = [
  { id: "first-day", name: "First day of Classes" },
  { id: "fall-break", name: "Fall Break" },
  { id: "thanksgiving", name: "Thanksgiving Break" },
  { id: "winter-break", name: "Winter Break" },
  { id: "spring-break", name: "Spring Break" },
  { id: "graduation", name: "Graduation" },
  { id: "last-day", name: "Last Day of Classes" },
];
