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
    
    // Get current year and next year for date range
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    // Fetch dates for each event
    for (const event of events) {
      try {
        // Comprehensive search query to find the date with year range
        const query = `What date is ${organizationName} ${event.name} ${currentYear}-${nextYear}`;
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
            console.log('First 500 chars of search context:', searchContext.substring(0, 500));

            // Use Gemini to extract the date with enhanced prompt
            const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  {
                    role: 'user',
                    content: `You are a date extraction expert. Extract the exact date for the event "${event.name}" hosted by "${organizationName}" from these search results.

Search Results:
${searchContext}

CRITICAL INSTRUCTIONS:
1. Look for ANY mention of dates for this event, including phrases like:
   - "graduation is expected to be on Thursday, May 14, 2026"
   - "Winter Break is from December 22, 2025 to January 2, 2026"
   - "Spring Break: March 15-23, 2026"
   - "The ceremony will be held on [date]"
   - "scheduled for [date]"

2. If you find a date range, return the FULL range: "Month Day, Year - Month Day, Year"
3. If you find multiple dates for different years, use the LATER year (${nextYear})
4. ONLY return dates in ${currentYear} or later
5. Return ONLY the date in format "Month Day, Year" or "Month Day, Year - Month Day, Year"
6. If NO date is found, respond with exactly: "NOT_FOUND"

Extract the date now:`
                  }
                ],
                max_tokens: 50
              }),
            });

            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
              
              console.log('Gemini extracted from search:', extracted);
              
              // Parse for date pattern (single date or range)
              const dateRangePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i;
              const singleDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i;
              const dateMatch = extracted.match(dateRangePattern) || extracted.match(singleDatePattern);
              
              if (dateMatch) {
                eventDates.push({ eventName: event.name, date: dateMatch[0] });
                console.log('✓ Found via Google Search for', event.name, ':', dateMatch[0]);
                await new Promise(resolve => setTimeout(resolve, 700));
                continue;
              }
            }
          }
        }

        // METHOD 2: If Google didn't work, ask Gemini directly with knowledge
        console.log('Trying Gemini direct knowledge query...');
        
        const directResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: `What is the exact date of "${event.name}" for ${organizationName} in ${currentYear}-${nextYear}?

IMPORTANT:
- If there are multiple dates (e.g., one in ${currentYear} and one in ${nextYear}), provide ONLY the LATER date (${nextYear})
- If there is a date range, provide the FULL range in format "Month Day, Year - Month Day, Year"
- Respond with the date or range in these formats: "Month Day, Year" or "Month Day, Year - Month Day, Year" (e.g., "March 21, 2026 - March 28, 2026")
- If you don't know the exact date, respond with exactly "NOT_FOUND"

Date:`
              }
            ],
            max_tokens: 50
          }),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const answer = directData.choices?.[0]?.message?.content?.trim() || '';
          
          console.log('Gemini knowledge answer:', answer);
          
          // Extract date pattern from response (range or single date)
          const dateRangePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const singleDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const dateMatch = answer.match(dateRangePattern) || answer.match(singleDatePattern);
          
          if (dateMatch) {
            eventDates.push({ eventName: event.name, date: dateMatch[0] });
            console.log('✓ Found via GPT-5 knowledge for', event.name, ':', dateMatch[0]);
          } else {
            eventDates.push({ eventName: event.name, date: null });
            console.log('✗ No date found for', event.name);
          }
          } else {
            const errorText = await directResponse.text();
            console.error('✗ Gemini request failed for', event.name, ':', errorText);
            eventDates.push({ eventName: event.name, date: null });
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
