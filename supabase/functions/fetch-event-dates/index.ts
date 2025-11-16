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
        // Comprehensive search query to find the date
        const query = `${organizationName} ${event.name} 2025 date when schedule`;
        console.log('Search Query:', query);

        // METHOD 1: Try Google Search API first
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.items && searchData.items.length > 0) {
            // Extract comprehensive search context including AI Overview-like content
            let searchContext = '';
            
            // Check for any answer box or featured snippet (Google's AI Overview equivalent in API)
            if (searchData.searchInformation?.answerBox) {
              searchContext += `AI Overview/Answer Box: ${JSON.stringify(searchData.searchInformation.answerBox)}\n\n---\n\n`;
            }
            
            // Collect rich data from top 10 results including HTML snippets
            searchContext += searchData.items.slice(0, 10)
              .map((item: any) => {
                let itemText = `Title: ${item.title}\nURL: ${item.link}\n`;
                
                // Include regular snippet
                if (item.snippet) {
                  itemText += `Snippet: ${item.snippet}\n`;
                }
                
                // Include HTML snippet which may have richer content
                if (item.htmlSnippet) {
                  // Remove HTML tags to get clean text
                  const cleanHtml = item.htmlSnippet.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  if (cleanHtml !== item.snippet) {
                    itemText += `Extended: ${cleanHtml}\n`;
                  }
                }
                
                // Include structured data if available
                if (item.pagemap?.metatags?.[0]) {
                  const meta = item.pagemap.metatags[0];
                  if (meta.description || meta['og:description']) {
                    itemText += `Meta: ${meta.description || meta['og:description']}\n`;
                  }
                }
                
                return itemText;
              })
              .join('\n---\n\n');
            
            console.log('Got comprehensive Google search results, length:', searchContext.length);

            // Use GPT-5 to extract the date with enhanced prompt
            const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'openai/gpt-5',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a date extraction expert. Your job is to find the exact date of events from search results including AI Overviews, answer boxes, and search snippets. Only return dates you are highly confident about from the provided context.'
                  },
                  {
                    role: 'user',
                    content: `Find the date for: "${event.name}" hosted by "${organizationName}"

Search Results (including AI Overview and snippets):
${searchContext}

Instructions:
1. Pay special attention to AI Overview/Answer Box content at the top
2. Look for explicit dates in all search result content
3. Prefer dates in 2025 or later
4. Return ONLY the date in "Month Day, Year" format (e.g., "March 15, 2025")
5. If no clear date is found, return exactly "NOT_FOUND"

Date:`
                  }
                ],
                max_completion_tokens: 50
              }),
            });

            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
              
              console.log('GPT-5 extracted from search:', extracted);
              
              // Parse for date pattern
              const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i;
              const dateMatch = extracted.match(datePattern);
              
              if (dateMatch) {
                eventDates.push({ eventName: event.name, date: dateMatch[0] });
                console.log('✓ Found via Google Search for', event.name, ':', dateMatch[0]);
                await new Promise(resolve => setTimeout(resolve, 700));
                continue;
              }
            }
          }
        }

        // METHOD 2: If Google didn't work, ask GPT-5 directly with knowledge
        console.log('Trying GPT-5 direct knowledge query...');
        
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
                role: 'system',
                content: 'You are an expert on organizational events and conferences. Provide accurate dates based on your knowledge. Only respond with dates you are confident about.'
              },
              {
                role: 'user',
                content: `What is the exact date of "${event.name}" for ${organizationName} in 2025?

Respond with ONLY the date in "Month Day, Year" format (e.g., "April 20, 2025").
If you don't know the exact date, respond with exactly "NOT_FOUND".

Date:`
              }
            ],
            max_completion_tokens: 50
          }),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const answer = directData.choices?.[0]?.message?.content?.trim() || '';
          
          console.log('GPT-5 knowledge answer:', answer);
          
          // Extract date pattern from response
          const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const dateMatch = answer.match(datePattern);
          
          if (dateMatch) {
            eventDates.push({ eventName: event.name, date: dateMatch[0] });
            console.log('✓ Found via GPT-5 knowledge for', event.name, ':', dateMatch[0]);
          } else {
            eventDates.push({ eventName: event.name, date: null });
            console.log('✗ No date found for', event.name);
          }
        } else {
          eventDates.push({ eventName: event.name, date: null });
          console.log('✗ GPT-5 request failed for', event.name);
        }

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 900));

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
