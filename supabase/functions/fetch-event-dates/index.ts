import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventDate {
  eventName: string;
  date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationName, events } = await req.json();

    if (!organizationName || !events || !Array.isArray(events)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiKey || !searchEngineId || !lovableApiKey) {
      console.error('Missing API credentials');
      return new Response(JSON.stringify({ error: 'Missing API credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventDates: EventDate[] = [];

    // Fetch dates for each event
    for (const event of events) {
      try {
        // Form Google Search query
        const query = `When is ${event.name} for ${organizationName}`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=3`;

        console.log('Searching for:', query);

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
          console.error('Search error for', event.name, ':', searchData);
          eventDates.push({ eventName: event.name, date: null });
          continue;
        }

        // Extract snippets from search results
        const snippets = searchData.items?.map((item: any) => item.snippet).join('\n') || '';

        if (!snippets) {
          console.log('No snippets found for', event.name);
          eventDates.push({ eventName: event.name, date: null });
          continue;
        }

        // Use AI to extract the date from snippets
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: `Extract the date from the search results. Return ONLY the date in format "Month Day, Year" (e.g., "May 15, 2025"). If you can't find a specific date, return "Date not found".`
              },
              {
                role: 'user',
                content: `Event: ${event.name}\nOrganization: ${organizationName}\n\nSearch results:\n${snippets}\n\nWhat is the date?`
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_date",
                  description: "Extract the event date from search results",
                  parameters: {
                    type: "object",
                    properties: {
                      date: {
                        type: "string",
                        description: "The date in format 'Month Day, Year' or 'Date not found'"
                      }
                    },
                    required: ["date"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "extract_date" } }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI error for', event.name, ':', errorText);
          eventDates.push({ eventName: event.name, date: null });
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        const dateStr = toolCall ? JSON.parse(toolCall.function.arguments).date : null;

        eventDates.push({
          eventName: event.name,
          date: dateStr && dateStr !== 'Date not found' ? dateStr : null
        });

        console.log('Found date for', event.name, ':', dateStr);

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error('Error fetching date for', event.name, ':', error);
        eventDates.push({ eventName: event.name, date: null });
      }
    }

    return new Response(JSON.stringify({ eventDates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fetch-event-dates function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
