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
        // Clean organization name for better search results
        const cleanOrgName = organizationName
          .replace(/:\s*Top Private University/i, '')
          .replace(/:\s*.*$/i, '')
          .trim();
        
        // Build specific search query based on event type
        let query = '';
        if (event.name.toLowerCase().includes('graduation') || event.name.toLowerCase().includes('commencement')) {
          query = `${cleanOrgName} commencement graduation ceremony ${nextYear} date schedule`;
        } else if (event.name.toLowerCase().includes('spring break')) {
          query = `${cleanOrgName} academic calendar spring break ${nextYear}`;
        } else {
          query = `${cleanOrgName} "${event.name}" ${nextYear} academic calendar`;
        }
        
        console.log('Search Query:', query);

        // METHOD 1: Try Google Search API first
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.items && searchData.items.length > 0) {
            // Extract comprehensive search context
            let searchContext = '';
            
            // Check for any answer box or featured snippet
            if (searchData.searchInformation?.answerBox) {
              searchContext += `Featured Answer: ${JSON.stringify(searchData.searchInformation.answerBox)}\n\n`;
            }
            
            // Prioritize official calendar and schedule pages
            const prioritizedItems = searchData.items.sort((a: any, b: any) => {
              const aUrl = a.link.toLowerCase();
              const bUrl = b.link.toLowerCase();
              const aScore = (aUrl.includes('calendar') ? 10 : 0) + 
                           (aUrl.includes('academic') ? 10 : 0) + 
                           (aUrl.includes('commencement') ? 10 : 0) +
                           (aUrl.includes('schedule') ? 5 : 0);
              const bScore = (bUrl.includes('calendar') ? 10 : 0) + 
                           (bUrl.includes('academic') ? 10 : 0) + 
                           (bUrl.includes('commencement') ? 10 : 0) +
                           (bUrl.includes('schedule') ? 5 : 0);
              return bScore - aScore;
            });
            
            // Collect detailed data from top results
            searchContext += prioritizedItems.slice(0, 10)
              .map((item: any, idx: number) => {
                let itemText = `\n[Result ${idx + 1}]\nTitle: ${item.title}\nURL: ${item.link}\n`;
                
                if (item.snippet) {
                  itemText += `Content: ${item.snippet}\n`;
                }
                
                if (item.htmlSnippet) {
                  const cleanHtml = item.htmlSnippet.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  if (cleanHtml !== item.snippet && cleanHtml.length > item.snippet.length) {
                    itemText += `Additional: ${cleanHtml}\n`;
                  }
                }
                
                if (item.pagemap?.metatags?.[0]) {
                  const meta = item.pagemap.metatags[0];
                  const desc = meta.description || meta['og:description'];
                  if (desc && desc !== item.snippet) {
                    itemText += `Description: ${desc}\n`;
                  }
                }
                
                return itemText;
              })
              .join('\n');

            console.log('Processed Google search results, length:', searchContext.length);
            console.log('Top result:', searchContext.substring(0, 300));

            // Use Gemini to extract the date with improved prompt
            const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-pro',
                messages: [
                  {
                    role: 'system',
                    content: 'You are an expert at extracting dates from academic calendars and university schedules. You carefully read search results to find specific event dates.'
                  },
                  {
                    role: 'user',
                    content: `Find the exact date of "${event.name}" at ${cleanOrgName} from these search results:

${searchContext}

Task:
- Look for the specific date of "${event.name}" in ${nextYear} (preferred) or ${currentYear}
- Common formats: "May 17, 2026", "March 15-23, 2026", "Saturday, May 17"
- Look in: academic calendars, commencement schedules, official university pages
- If you find multiple dates, choose the one in ${nextYear}

Return format:
- Single date: "Month Day, Year" (e.g., "May 17, 2026")
- Date range: "Month Day-Day, Year" (e.g., "March 15-23, 2026")
- If not found: "NOT_FOUND"

Respond with ONLY the date or "NOT_FOUND":`
                  }
                ],
                max_tokens: 150
              }),
            });

            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
              
              console.log('Gemini extraction result:', extracted);
              
              // Don't proceed if explicitly not found
              if (extracted === 'NOT_FOUND') {
                console.log('✗ Gemini could not find date in search results');
              } else {
                // More flexible date patterns
                const dateRangeWithYear = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\s*-\s*\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                const dateRangeFullMonths = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                const singleDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                
                const dateMatch = extracted.match(dateRangeFullMonths) || 
                                extracted.match(dateRangeWithYear) || 
                                extracted.match(singleDatePattern);
                
                if (dateMatch) {
                  const cleanDate = dateMatch[0].replace(/(\d)(st|nd|rd|th)/g, '$1');
                  eventDates.push({ eventName: event.name, date: cleanDate });
                  console.log('✓ Found via Google Search:', cleanDate);
                  await new Promise(resolve => setTimeout(resolve, 800));
                  continue;
                }
              }
            }
          }
        }

        // METHOD 2: Try with a broader search if first attempt failed
        console.log('Trying broader search...');
        const broaderQuery = `"${cleanOrgName}" "${event.name}" ${nextYear}`;
        const broaderUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(broaderQuery)}&num=5`;
        const broaderResponse = await fetch(broaderUrl);
        
        if (broaderResponse.ok) {
          const broaderData = await broaderResponse.json();
          if (broaderData.items && broaderData.items.length > 0) {
            const broaderContext = broaderData.items.map((item: any) => 
              `${item.title}\n${item.snippet || ''}`
            ).join('\n\n');
            
            const secondExtract = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-pro',
                messages: [
                  {
                    role: 'user',
                    content: `Extract "${event.name}" date for ${cleanOrgName}:\n\n${broaderContext}\n\nReturn format: "Month Day, Year" or "NOT_FOUND":`
                  }
                ],
                max_tokens: 100
              }),
            });
            
            if (secondExtract.ok) {
              const data = await secondExtract.json();
              const result = data.choices?.[0]?.message?.content?.trim() || '';
              const match = result.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i);
              if (match) {
                const cleanDate = match[0].replace(/(\d)(st|nd|rd|th)/g, '$1');
                eventDates.push({ eventName: event.name, date: cleanDate });
                console.log('✓ Found via broader search:', cleanDate);
                await new Promise(resolve => setTimeout(resolve, 800));
                continue;
              }
            }
          }
        }

        // If still no date found, mark as not available
        console.log('✗ No date found for', event.name);
        eventDates.push({ eventName: event.name, date: null });

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
