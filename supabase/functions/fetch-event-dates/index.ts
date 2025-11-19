import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventDate {
  eventName: string;
  date: string;
}

// Helper function to validate date is in the future
function isDateInFuture(dateString: string): boolean {
  try {
    const parsedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsedDate >= today;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationName } = await req.json();
    
    if (!organizationName || typeof organizationName !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid organization name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (organizationName.length > 500) {
      return new Response(JSON.stringify({ error: 'Organization name too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('Missing Lovable API key');
      return new Response(JSON.stringify({ error: 'Missing API credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    // Determine school year (July onwards = next school year)
    const schoolYearStart = currentMonth >= 6 ? currentYear : currentYear - 1;
    const schoolYearEnd = schoolYearStart + 1;
    
    console.log(`🎓 Fetching academic calendar for ${organizationName} (${schoolYearStart}-${schoolYearEnd})`);
    
    const calendarResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `You are an academic calendar assistant.

For the ${schoolYearStart}-${schoolYearEnd} school year, return the MOST IMPORTANT academic dates for ${organizationName}.

STRICT FORMAT:
- Your ENTIRE response MUST be a single valid JSON array.
- Do NOT include Markdown code fences, comments, or explanations.
- Include AT MOST 50 events.

JSON format:
[
  {"name": "First Day of Classes", "date": "August 25, 2025"},
  {"name": "Fall Break", "date": "October 13, 2025"},
  {"name": "Thanksgiving Break", "date": "November 27, 2025"}
]

When choosing events, prioritize (if available):
- First day of classes/semester
- Fall break, reading days, autumn break
- Thanksgiving break
- Winter/holiday break
- Spring break
- Last day of classes/semester
- Graduation/commencement
- Final exams periods
- Registration deadlines and other major academic milestones

Use the exact event names from the calendar.
Only include future dates (on or after today).` 
          },
          { 
            role: 'user', 
            content: `Find all academic calendar dates for ${organizationName} for the ${schoolYearStart}-${schoolYearEnd} school year` 
          }
        ],
        max_tokens: 4000
      }),
    });

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('AI API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const calendarData = await calendarResponse.json();
    const calendarAnswer = calendarData.choices?.[0]?.message?.content?.trim() || '';
    
    // Validate response exists
    if (!calendarAnswer) {
      console.error('Empty response from AI');
      return new Response(JSON.stringify({ error: 'No calendar data found', eventDates: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract JSON from response
    let jsonStr = calendarAnswer;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    }
    
    // Validate JSON string is not empty
    if (!jsonStr.trim()) {
      console.error('Empty JSON string after extraction');
      return new Response(JSON.stringify({ error: 'Invalid calendar data format', eventDates: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    let parsedEvents;
    try {
      parsedEvents = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Primary JSON parse error:', parseError, 'Raw response:', calendarAnswer);
      // Attempt to recover a valid JSON array from the response
      const arrayMatch = jsonStr.match(/\[\s*{[\s\S]*}\s*\]/);

      if (arrayMatch) {
        try {
          parsedEvents = JSON.parse(arrayMatch[0]);
          console.log('✅ Recovered calendar events from partial JSON');
        } catch (secondaryError) {
          console.error('Secondary JSON parse error after recovery attempt:', secondaryError);
          return new Response(JSON.stringify({ error: 'Failed to parse calendar data', eventDates: [] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: 'Failed to parse calendar data', eventDates: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    console.log('📅 Parsed calendar events:', parsedEvents);
    
    const eventDates: EventDate[] = [];
    
    if (Array.isArray(parsedEvents)) {
      for (const event of parsedEvents) {
        if (event.name && event.date) {
          const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const dateMatch = event.date.match(datePattern);
          
          if (dateMatch && isDateInFuture(dateMatch[0])) {
            console.log(`✅ ${event.name}: ${dateMatch[0]}`);
            eventDates.push({ 
              eventName: event.name, 
              date: dateMatch[0] 
            });
          }
        }
      }
    }
    
    console.log(`📊 Found ${eventDates.length} future events`);

    return new Response(
      JSON.stringify({ eventDates }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
