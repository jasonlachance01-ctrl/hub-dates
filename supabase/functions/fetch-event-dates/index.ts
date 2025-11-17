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
    
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    for (const event of events) {
      try {
        const query = `${organizationName} ${event.name} date ${currentYear} ${nextYear}`;
        console.log('🔍 Search Query:', query);

        let dateFound = false;

        // METHOD 1: Try Google Search scraping for AI Overview
        try {
          const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`;
          const pageResponse = await fetch(googleSearchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            console.log('✓ Fetched Google page, length:', html.length);
            
            if (html.length > 5000 && !html.includes('redirected within')) {
              let aiOverviewText = '';
              
              const dateRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)[^<]{0,200}?\d{4}/gi;
              const allDateText = html.match(dateRegex);
              if (allDateText && allDateText.length > 0) {
                aiOverviewText = allDateText.slice(0, 20).join('\n\n');
                console.log('📄 Extracted date text, segments:', allDateText.length);
              }
              
              if (aiOverviewText) {
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
                        content: `Extract ${event.name} date for ${organizationName} from:\n\n${aiOverviewText}\n\nReturn ONLY date in "Month Day, Year" format or "NOT_FOUND". Only ${currentYear} or ${nextYear} dates.`
                      }
                    ],
                    max_tokens: 70
                  }),
                });

                if (extractResponse.ok) {
                  const extractData = await extractResponse.json();
                  const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                  console.log('🤖 AI Overview extraction:', extracted);
                  
                  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                  const dateMatch = extracted.match(datePattern);
                  
                  if (dateMatch) {
                    eventDates.push({ eventName: event.name, date: dateMatch[0] });
                    console.log('✅ SUCCESS via AI Overview:', dateMatch[0]);
                    dateFound = true;
                  }
                }
              }
            }
          }
        } catch (e) {
          console.log('⚠️ Google scraping failed:', e);
        }

        if (dateFound) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // METHOD 2: Try Google Search API
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.items && searchData.items.length > 0) {
            const searchContext = searchData.items.slice(0, 10)
              .map((item: any) => `${item.title}: ${item.snippet || ''}`)
              .join('\n\n');
            
            console.log('📄 Google API results, length:', searchContext.length);

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
                    content: `Extract ${event.name} date for ${organizationName} from:\n\n${searchContext}\n\nReturn ONLY date in "Month Day, Year" format or "NOT_FOUND". Only ${currentYear} or ${nextYear} dates.`
                  }
                ],
                max_tokens: 50
              }),
            });

            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
              console.log('🤖 API extraction:', extracted);
              
              const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
              const dateMatch = extracted.match(datePattern);
              
              if (dateMatch) {
                eventDates.push({ eventName: event.name, date: dateMatch[0] });
                console.log('✅ SUCCESS via API:', dateMatch[0]);
                dateFound = true;
              }
            }
          }
        }

        if (dateFound) {
          await new Promise(resolve => setTimeout(resolve, 700));
          continue;
        }

        // METHOD 3: Gemini direct knowledge
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
                content: `What is the date of ${event.name} for ${organizationName} in ${currentYear} or ${nextYear}? Return ONLY the date in "Month Day, Year" format or "NOT_FOUND".`
              }
            ],
            max_tokens: 50
          }),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const answer = directData.choices?.[0]?.message?.content?.trim() || '';
          console.log('🤖 Direct knowledge:', answer);
          
          const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const dateMatch = answer.match(datePattern);
          
          if (dateMatch) {
            eventDates.push({ eventName: event.name, date: dateMatch[0] });
            console.log('✅ SUCCESS via direct knowledge:', dateMatch[0]);
          } else {
            eventDates.push({ eventName: event.name, date: null });
            console.log('❌ NO DATE FOUND');
          }
        } else {
          eventDates.push({ eventName: event.name, date: null });
        }

        await new Promise(resolve => setTimeout(resolve, 1200));

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
