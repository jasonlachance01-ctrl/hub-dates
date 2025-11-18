import { z } from "zod";

// Organization name/URL validation
// Uses Unicode property escapes for international character support
// Supports: letters (any script), numbers, common punctuation
export const organizationInputSchema = z.string()
  .trim()
  .min(1, "Organization name or URL is required")
  .max(500, "Organization name or URL must be less than 500 characters")
  .refine(
    (value) => {
      // First, try to validate as URL
      if (value.includes('.')) {
        try {
          // Attempt to parse as URL (with or without protocol)
          const urlTest = value.startsWith('http') ? value : `https://${value}`;
          new URL(urlTest);
          return true;
        } catch {
          // Not a valid URL, continue to name validation
        }
      }
      
      // Validate as organization name with Unicode support
      // \p{L} = any Unicode letter (covers accented chars, non-Latin scripts like Chinese, Arabic, etc.)
      // \p{N} = any Unicode number
      // Also allows: spaces, hyphen, period, apostrophe, ampersand, comma, parentheses, colon, slash
      // The 'u' flag enables full Unicode support
      const namePattern = /^[\p{L}\p{N}\s\-.'&,():\/]+$/u;
      return namePattern.test(value);
    },
    "Please enter a valid organization name or URL"
  );

// Event name validation
export const eventNameSchema = z.string()
  .trim()
  .min(1, "Event name is required")
  .max(200, "Event name must be less than 200 characters")
  .refine(
    (value) => /^[a-zA-Z0-9\s\-.'()]+$/.test(value),
    "Event name contains invalid characters"
  );

// Validate organization input
export function validateOrganizationInput(input: string): { success: boolean; error?: string } {
  const result = organizationInputSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }
  return { success: true };
}

// Validate event name
export function validateEventName(name: string): { success: boolean; error?: string } {
  const result = eventNameSchema.safeParse(name);
  if (!result.success) {
    return { success: false, error: result.error.errors[0].message };
  }
  return { success: true };
}

// Validate multiple event names
export function validateEventNames(names: string[]): { success: boolean; error?: string } {
  for (const name of names) {
    const result = validateEventName(name);
    if (!result.success) {
      return result;
    }
  }
  return { success: true };
}
