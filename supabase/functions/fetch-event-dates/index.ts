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

// Helper function to validate date is in the future
function isDateInFuture(dateString: string): boolean {
  try {
    const parsedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare dates, not times
    return parsedDate >= today;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationName, events } = await req.json();
    
    // Input validation
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

    if (!Array.isArray(events)) {
      return new Response(JSON.stringify({ error: 'Invalid events format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (events.length === 0) {
      return new Response(JSON.stringify({ error: 'No events provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (events.length > 50) {
      return new Response(JSON.stringify({ error: 'Too many events requested' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Validate each event
    for (const event of events) {
      const eventName = typeof event === 'string' ? event : event.name;
      if (!eventName || typeof eventName !== 'string' || eventName.length > 200) {
        return new Response(JSON.stringify({ error: 'Invalid event name' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
    const startTime = Date.now();
    const MAX_PROCESSING_TIME = 25000;
    
    // Track which events still need dates
    const eventsNeedingDates = new Set(events.map(e => typeof e === 'string' ? e : e.name));
    
    // METHOD 0: Try academic calendar query first if multiple events selected
    if (events.length > 1) {
      try {
        console.log('🎓 Querying full academic calendar for all events...');
        const schoolYear = `${currentYear}-${nextYear}`;
        const eventNamesList = Array.from(eventsNeedingDates).join(', ');
        
        const calendarResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: `You are an academic calendar assistant. Return dates in JSON format with this exact structure:
{
  "First Day": "Month DD, YYYY",
  "Fall Break": "Month DD, YYYY",
  "Thanksgiving": "Month DD, YYYY",
  "Winter Break": "Month DD, YYYY",
  "Spring Break": "Month DD, YYYY",
  "Graduation": "Month DD, YYYY",
  "Last Day": "Month DD, YYYY"
}

Map academic calendar terms to these event names:
- "First Day" = first day of fall semester/classes
- "Fall Break" = fall break, autumn break, fall recess, reading days in October/November
- "Thanksgiving" = thanksgiving break, thanksgiving recess
- "Winter Break" = winter break, winter recess, holiday break, last day before winter break
- "Spring Break" = spring break, spring recess
- "Graduation" = graduation, commencement
- "Last Day" = last day of spring semester/classes, end of academic year

Only include events that are explicitly in the calendar. Use "NOT_FOUND" for events not in the calendar. Return ONLY valid JSON, no additional text.` 
              },
              { 
                role: 'user', 
                content: `${organizationName} academic calendar ${schoolYear}. Extract dates for: ${eventNamesList}` 
              }
            ],
            max_tokens: 300
          }),
        }, 8000);

        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          const calendarAnswer = calendarData.choices?.[0]?.message?.content?.trim() || '';
          
          try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = calendarAnswer;
            if (jsonStr.includes('```')) {
              jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            }
            
            const parsedDates = JSON.parse(jsonStr);
            console.log('📅 Parsed calendar dates:', parsedDates);
            
            // Process each event from the calendar response
            for (const eventName of eventsNeedingDates) {
              const dateValue = parsedDates[eventName];
              
              if (dateValue && dateValue !== 'NOT_FOUND') {
                const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                const dateMatch = dateValue.match(datePattern);
                
                if (dateMatch && isDateInFuture(dateMatch[0])) {
                  console.log(`✅ Found via Academic Calendar - ${eventName}: ${dateMatch[0]}`);
                  eventDates.push({ eventName, date: dateMatch[0] });
                  eventsNeedingDates.delete(eventName);
                }
              }
            }
            
            console.log(`📊 Academic calendar found ${eventDates.length}/${events.length} dates`);
          } catch (parseError) {
            console.error('❌ Failed to parse calendar JSON:', parseError);
          }
        }
      } catch (error) {
        console.error('Academic calendar query error:', error);
      }
    }

    // Process remaining events individually using fallback methods
    for (const event of events) {
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log('⏱️ Time limit approaching, returning partial results');
        break;
      }

      try {
        const eventName = typeof event === 'string' ? event : event.name;
        
        // Skip if we already found this event in the academic calendar query
        if (!eventsNeedingDates.has(eventName)) {
          console.log(`⏭️  Skipping ${eventName} - already found`);
          continue;
        }
        
        const eventSearchTerms = eventName === "Graduation" ? ["Graduation", "Commencement"] : [eventName];
        const eventTermDescription = eventSearchTerms.join(" or ");
        
        // Reduced to 1-2 queries max per event for performance
        const queries: string[] = [];
        for (const term of eventSearchTerms) {
          // Use only the most specific query
          queries.push(`${organizationName} ${term} date ${currentYear} ${nextYear}`);
        }
        // Max 2 queries total (handles Graduation with 2 terms)
        
        let dateFound = false;
        let queryIndex = 0;

        while (!dateFound && queryIndex < queries.length) {
          if (Date.now() - startTime > MAX_PROCESSING_TIME) break;

          const query = queries[queryIndex];
          console.log(`🔍 Query ${queryIndex + 1}/${queries.length}:`, query);
          queryIndex++;

          // METHOD 0: Direct AI Query using academic calendar
          if (queryIndex === 1) { // Only try once per event
            try {
              console.log('🤖 Asking AI for academic calendar date...');
              const schoolYear = `${currentYear}-${nextYear}`;
              
              // Define event mapping for the AI
              const eventMapping = {
                "First Day": "first day of fall semester/classes",
                "Fall Break": "fall break, autumn break, fall recess, reading days in October/November",
                "Thanksgiving": "thanksgiving break, thanksgiving recess",
                "Winter Break": "winter break, winter recess, holiday break, last day before winter break",
                "Spring Break": "spring break, spring recess",
                "Graduation": "graduation, commencement",
                "Last Day": "last day of spring semester/classes, end of academic year"
              };
              
              const eventDescription = eventMapping[eventName as keyof typeof eventMapping] || eventTermDescription;
              
              const aiQueryResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                      content: `You are an academic calendar assistant. You will be asked about a specific event from a school's academic calendar. Look for terms like: ${eventDescription}. Return ONLY the date in format "Month DD, YYYY" or "NOT_FOUND" if you do not know. Do not provide explanations.` 
                    },
                    { 
                      role: 'user', 
                      content: `${organizationName} academic calendar ${schoolYear}. When is the ${eventName}?` 
                    }
                  ],
                  max_tokens: 50
                }),
              }, 5000);

              if (aiQueryResponse.ok) {
                const aiData = await aiQueryResponse.json();
                const aiAnswer = aiData.choices?.[0]?.message?.content?.trim() || '';
                
                const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i;
                const dateMatch = aiAnswer.match(datePattern);
                
                if (aiAnswer !== 'NOT_FOUND' && dateMatch && isDateInFuture(dateMatch[0])) {
                  console.log(`✅ SUCCESS via Direct AI: ${dateMatch[0]}`);
                  eventDates.push({ eventName, date: dateMatch[0] });
                  dateFound = true;
                  break; // Early exit
                } else if (dateMatch && !isDateInFuture(dateMatch[0])) {
                  console.log(`❌ AI returned past date (${dateMatch[0]}), ignoring`);
                } else {
                  console.log('❌ AI does not have this date in training data');
                }
              }
            } catch (error) {
              console.error('METHOD 0 error:', error);
            }
          }

          if (dateFound) break; // Early exit

          // METHOD 1: Google Search scraping
          try {
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`;
            const pageResponse = await fetchWithTimeout(googleSearchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html',
              }
            }, 5000);
            
            if (pageResponse.ok) {
              const html = await pageResponse.text();
              const spelledDateRegex = /.{0,300}(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}.{0,300}/gi;
              const numericalDateRegex = /.{0,300}\d{1,2}\/\d{1,2}\/\d{4}.{0,300}/gi;
              
              const spelledDates = html.match(spelledDateRegex) || [];
              const numericalDates = html.match(numericalDateRegex) || [];
              const allDateText = [...spelledDates, ...numericalDates];
              
              if (allDateText.length > 0) {
                const aiContext = allDateText.slice(0, 10).join('\n\n---\n\n');
                
                const extractResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${lovableApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'google/gemini-2.5-flash-lite',
                    messages: [
                      { role: 'system', content: `Extract the ${eventTermDescription} date for ${organizationName} from ${currentYear} or ${nextYear}. Return ONLY the date or "NOT_FOUND".` },
                      { role: 'user', content: aiContext }
                    ],
                    max_tokens: 50
                  }),
                }, 5000);

                if (extractResponse.ok) {
                  const extractData = await extractResponse.json();
                  const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                  
                  if (extracted !== 'NOT_FOUND') {
                    const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i;
                    if (datePattern.test(extracted) && isDateInFuture(extracted)) {
                      console.log(`✅ SUCCESS via Google: ${extracted}`);
                      eventDates.push({ eventName, date: extracted });
                      dateFound = true;
                      break; // Early exit: stop processing this query immediately
                    } else if (datePattern.test(extracted)) {
                      console.log(`❌ Past date found via Google (${extracted}), ignoring`);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('METHOD 1 error:', error);
          }

          if (dateFound) break; // Early exit: stop processing queries for this event

          // METHOD 2: API search with PARALLEL webpage fetching
          if (!dateFound) {
            try {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=2`;
              const searchResponse = await fetchWithTimeout(searchUrl, {}, 5000);
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  const webpageItems = searchData.items.filter((item: any) =>
                    !(item.link?.toLowerCase().endsWith('.pdf') || item.mime?.includes('pdf'))
                  );
                  
                  if (webpageItems.length > 0) {
                    console.log(`🌐 Fetching ${webpageItems.length} pages in PARALLEL...`);
                    
                    // PARALLEL FETCH using Promise.allSettled
                    const results = await Promise.allSettled(
                      webpageItems.map(async (item: any) => {
                        try {
                          const pageResponse = await fetchWithTimeout(item.link, {
                            headers: {
                              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                              'Accept': 'text/html',
                            }
                          }, 8000);
                          
                          if (pageResponse.ok) {
                            const html = await pageResponse.text();
                            
                            if (html.length > 5000) {
                              const spelledDateRegex = /.{0,300}(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}.{0,300}/gi;
                              const spelledDates = html.match(spelledDateRegex) || [];
                              
                              if (spelledDates.length > 0) {
                                const aiContext = spelledDates.slice(0, 8).join('\n\n---\n\n');
                                
                                const extractResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${lovableApiKey}`,
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    model: 'google/gemini-2.5-flash-lite',
                                    messages: [
                                      { role: 'system', content: `Extract the ${eventTermDescription} date for ${organizationName} from ${currentYear} or ${nextYear}. Return ONLY the date or "NOT_FOUND".` },
                                      { role: 'user', content: aiContext }
                                    ],
                                    max_tokens: 50
                                  }),
                                }, 7000);

                                if (extractResponse.ok) {
                                  const extractData = await extractResponse.json();
                                  const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                                  
                                  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                                  if (extracted !== 'NOT_FOUND' && datePattern.test(extracted) && isDateInFuture(extracted)) {
                                    return { date: extracted, source: item.link };
                                  } else if (datePattern.test(extracted)) {
                                    console.log(`❌ Past date found (${extracted}), ignoring`);
                                  }
                                }
                              }
                            }
                          }
                        } catch (err) {
                          console.error('Page fetch error:', err);
                        }
                        return null;
                      })
                    );
                    
                    // Check results
                    for (const result of results) {
                      if (result.status === 'fulfilled' && result.value) {
                        console.log(`✅ SUCCESS via HTML: ${result.value.date} from ${result.value.source}`);
                        eventDates.push({ eventName, date: result.value.date });
                        dateFound = true;
                        break; // Early exit: stop processing parallel results immediately
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error('METHOD 2 error:', error);
            }
          }

          if (dateFound) break; // Early exit: stop processing queries for this event

          // METHOD 3: API snippets fallback
          if (!dateFound) {
            try {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=3`;
              const searchResponse = await fetchWithTimeout(searchUrl, {}, 5000);
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  const snippets = searchData.items.map((item: any) => item.snippet).filter((s: string) => s).join('\n\n');
                  const sourceUrls = searchData.items.map((item: any) => item.link).filter((url: string) => url).join(', ');
                  
                  if (snippets.length > 100) {
                    const extractResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${lovableApiKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: 'google/gemini-2.5-flash-lite',
                        messages: [
                          { role: 'system', content: `Extract the ${eventTermDescription} date for ${organizationName} from ${currentYear} or ${nextYear}. Return ONLY the date or "NOT_FOUND".` },
                          { role: 'user', content: snippets }
                        ],
                        max_tokens: 50
                      }),
                    }, 7000);

                    if (extractResponse.ok) {
                      const extractData = await extractResponse.json();
                      const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                      
                      const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/i;
                      const dateMatch = extracted.match(datePattern);
                      
                      if (dateMatch && isDateInFuture(dateMatch[0])) {
                        console.log('✅ SUCCESS via API snippets:', dateMatch[0], 'from', sourceUrls);
                        eventDates.push({ eventName, date: dateMatch[0] });
                        dateFound = true;
                        break; // Early exit: stop processing snippets immediately
                      } else if (dateMatch) {
                        console.log(`❌ Past date found via snippets (${dateMatch[0]}), ignoring`);
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ API search failed:', (e as Error).message);
            }
          }
        }

        if (!dateFound) {
          eventDates.push({ eventName, date: null });
          console.log('❌ No date found for:', eventName);
        }

      } catch (error) {
        const eventName = typeof event === 'string' ? event : event.name;
        console.error(`Error processing ${eventName}:`, error);
        eventDates.push({ eventName, date: null });
      }
    }

    return new Response(JSON.stringify({ eventDates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
