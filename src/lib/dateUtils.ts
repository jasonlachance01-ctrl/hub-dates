import { format, parse } from "date-fns";

/**
 * Normalizes various date formats into a consistent, readable format
 * Handles:
 * - Spelled-out dates: "March 12, 2026" -> "March 12, 2026"
 * - Numerical dates: "3/13/2026" -> "March 13, 2026"
 * - Date ranges: "3/13/2026 to 3/22/2026" -> "March 13-22, 2026"
 */
export function normalizeDateDisplay(dateString: string | null | undefined): string {
  if (!dateString) {
    return "Date not available";
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison

    // Check if it's a date range (e.g., "3/13/2026 to 3/22/2026")
    const rangeMatch = dateString.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (rangeMatch) {
      const startDate = parse(rangeMatch[1], "M/d/yyyy", new Date());
      const endDate = parse(rangeMatch[2], "M/d/yyyy", new Date());
      
      // Don't show past date ranges
      if (endDate < today) {
        return "Date not available";
      }
      
      // If same month and year, show as "March 13-22, 2026"
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        return `${format(startDate, "MMMM d")}-${format(endDate, "d, yyyy")}`;
      }
      
      // If different months but same year, show as "March 13 - April 2, 2026"
      if (startDate.getFullYear() === endDate.getFullYear()) {
        return `${format(startDate, "MMMM d")} - ${format(endDate, "MMMM d, yyyy")}`;
      }
      
      // If different years, show full dates
      return `${format(startDate, "MMMM d, yyyy")} - ${format(endDate, "MMMM d, yyyy")}`;
    }

    // Check if it's a numerical date (e.g., "3/13/2026")
    const numericalMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (numericalMatch) {
      const date = parse(dateString, "M/d/yyyy", new Date());
      
      // Don't show past dates
      if (date < today) {
        return "Date not available";
      }
      
      return format(date, "MMMM d, yyyy");
    }

    // Check if it's already a spelled-out date (e.g., "March 12, 2026")
    const spelledMatch = dateString.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}$/i);
    if (spelledMatch) {
      // Remove ordinal suffixes (st, nd, rd, th) if present
      const cleaned = dateString.replace(/(\d+)(st|nd|rd|th)/i, "$1");
      // Try to parse and reformat for consistency
      try {
        const date = parse(cleaned, "MMMM d, yyyy", new Date());
        
        // Don't show past dates
        if (date < today) {
          return "Date not available";
        }
        
        return format(date, "MMMM d, yyyy");
      } catch {
        // If parsing fails, return the original cleaned string
        return cleaned;
      }
    }

    // If format not recognized, return as-is
    return dateString;
  } catch (error) {
    console.error("Error normalizing date:", dateString, error);
    return dateString;
  }
}
