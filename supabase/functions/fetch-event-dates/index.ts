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
        // Simple, direct query - exactly how a user would ask
        const query = `What date is ${event.name} for ${organizationName}`;
        console.log('Query:', query);

        // METHOD 1: Try Google Search API first
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.items && searchData.items.length > 0) {
            // Collect snippets from top 3 results
            const snippets = searchData.items.slice(0, 3)
              .map((item: any) => `${item.title}\n${item.snippet}`)
              .join('\n\n');
            
            console.log('Got Google snippets, length:', snippets.length);

            // Use GPT-5 Mini to extract the date from snippets
            const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'openai/gpt-5-mini',
                messages: [
                  {
                    role: 'user',
                    content: `Look at these Google search results and extract the EXACT date for this question: "${query}"

Search Results:
${snippets}

Return ONLY the date in "Month Day, Year" format (like "May 15, 2025"). If you cannot find a specific date, return "NOT_FOUND".`
                  }
                ],
                temperature: 0,
                max_completion_tokens: 50
              }),
            });

            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
              
              console.log('Extracted from Google:', extracted);
              
              if (extracted && extracted !== 'NOT_FOUND' && !extracted.includes('NOT_FOUND') && extracted.length < 100) {
                eventDates.push({ eventName: event.name, date: extracted });
                console.log('✓ Found via Google for', event.name);
                await new Promise(resolve => setTimeout(resolve, 600));
                continue;
              }
            }
          }
        }

        // METHOD 2: If Google didn't work, ask GPT-5 directly
        console.log('Trying GPT-5 direct answer...');
        
        const directResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-5',
            messages: [
              {
                role: 'user',
                content: `${query}

Answer with ONLY the date in "Month Day, Year" format. If you do not know the specific date, return "NOT_FOUND".`
              }
            ],
            temperature: 0.2,
            max_completion_tokens: 100
          }),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const answer = directData.choices?.[0]?.message?.content?.trim() || '';
          
          console.log('GPT-5 direct answer:', answer);
          
          // Extract date pattern from response
          const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const dateMatch = answer.match(datePattern);
          
          if (dateMatch) {
            eventDates.push({ eventName: event.name, date: dateMatch[0] });
            console.log('✓ Found via GPT-5 for', event.name, ':', dateMatch[0]);
          } else if (answer && answer !== 'NOT_FOUND' && !answer.includes('NOT_FOUND') && answer.length < 100) {
            // Use the answer as-is if it looks like a date
            eventDates.push({ eventName: event.name, date: answer });
            console.log('✓ Using GPT-5 answer for', event.name, ':', answer);
          } else {
            eventDates.push({ eventName: event.name, date: null });
            console.log('✗ No date found for', event.name);
          }
        } else {
          eventDates.push({ eventName: event.name, date: null });
          console.log('✗ GPT-5 request failed for', event.name);
        }

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 800));

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
