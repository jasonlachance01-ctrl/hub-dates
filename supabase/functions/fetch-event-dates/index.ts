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
        // Try multiple query variations for better results
        const queries = [
          `${organizationName} ${event.name} date ${currentYear} ${nextYear}`,
          `${organizationName} ${event.name} ${nextYear}`,
          `${organizationName} calendar ${event.name} ${nextYear}`,
          `site:${organizationName.toLowerCase().replace(/\s+/g, '')}.com ${event.name} ${nextYear}`
        ];
        
        let dateFound = false;
        let queryIndex = 0;
        let methodUsed = ''; // Track which extraction method succeeded

        while (!dateFound && queryIndex < queries.length) {
          const query = queries[queryIndex];
          console.log(`🔍 Search Query (attempt ${queryIndex + 1}):`, query);
          queryIndex++;

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
                
                // Extract larger context around dates - 300 chars before and after
                const dateRegex = /.{0,300}(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}.{0,300}/gi;
                const allDateText = html.match(dateRegex);
                if (allDateText && allDateText.length > 0) {
                  // Take up to 10 matches with context
                  aiOverviewText = allDateText.slice(0, 10).join('\n\n---\n\n');
                  console.log('📄 Extracted date contexts, segments:', allDateText.length);
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
                          role: 'system',
                          content: `You are a date extractor. Look for the ${event.name} date for ${organizationName}. Only extract dates from ${currentYear} or ${nextYear}. Return ONLY the date in "Month Day, Year" format (e.g., "May 16, 2026") or "NOT_FOUND" if not found.`
                        },
                        {
                          role: 'user',
                          content: `Find the ${event.name} date in this text:\n\n${aiOverviewText}`
                        }
                      ],
                      max_tokens: 50
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
                      methodUsed = 'AI Overview';
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
            break; // Exit query retry loop
          }

          // METHOD 2: Fetch first result's full webpage
          if (!dateFound) {
            try {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=1`;
              const searchResponse = await fetch(searchUrl);
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  const firstResult = searchData.items[0];
                  console.log('📍 Fetching first result:', firstResult.link);
                  
                  try {
                    const pageResponse = await fetch(firstResult.link, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html',
                      },
                      signal: AbortSignal.timeout(5000) // 5 second timeout
                    });
                    
                    if (pageResponse.ok) {
                      const html = await pageResponse.text();
                      console.log('✓ Fetched webpage, length:', html.length);
                      
                      // Extract dates with context
                      const dateRegex = /.{0,300}(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}.{0,300}/gi;
                      const allDateText = html.match(dateRegex);
                      
                      if (allDateText && allDateText.length > 0) {
                        const dateContext = allDateText.slice(0, 15).join('\n\n---\n\n');
                        console.log('📄 Extracted date contexts from webpage, segments:', allDateText.length);
                        
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
                                role: 'system',
                                content: `You are a date extractor. Look for the ${event.name} date for ${organizationName}. Only extract dates from ${currentYear} or ${nextYear}. Return ONLY the date in "Month Day, Year" format (e.g., "May 16, 2026") or "NOT_FOUND" if not found.`
                              },
                              {
                                role: 'user',
                                content: `Find the ${event.name} date from ${organizationName}'s webpage:\n\n${dateContext}`
                              }
                            ],
                            max_tokens: 50
                          }),
                        });

                        if (extractResponse.ok) {
                          const extractData = await extractResponse.json();
                          const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                          console.log('🤖 Webpage extraction:', extracted);
                          
                          const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                          const dateMatch = extracted.match(datePattern);
                          
                          if (dateMatch) {
                            eventDates.push({ eventName: event.name, date: dateMatch[0] });
                            methodUsed = 'Full Webpage';
                            console.log('✅ SUCCESS via Full Webpage:', dateMatch[0]);
                            dateFound = true;
                          }
                        }
                      }
                    }
                  } catch (e) {
                    console.log('⚠️ Webpage fetch failed:', e);
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ First result fetch failed:', e);
            }
          }

          if (dateFound) {
            break; // Exit query retry loop
          }

          // METHOD 3: Try Google Search API snippets
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10`;
          const searchResponse = await fetch(searchUrl);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            
            if (searchData.items && searchData.items.length > 0) {
              // Store search results for source tracking
              const searchResults = searchData.items.slice(0, 10);
              const searchContext = searchResults
                .map((item: any) => `${item.title}: ${item.snippet || ''}`)
                .join('\n\n');
              
              console.log('📄 Google API snippets, length:', searchContext.length);

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
                      role: 'system',
                      content: `You are a date extractor. Look for the ${event.name} date for ${organizationName}. Only extract dates from ${currentYear} or ${nextYear}. Return ONLY the date in "Month Day, Year" format (e.g., "May 16, 2026") or "NOT_FOUND" if not found.`
                    },
                    {
                      role: 'user',
                      content: `Search results:\n\n${searchContext}\n\nWhat is the ${event.name} date?`
                    }
                  ],
                  max_tokens: 50
                }),
              });

              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                console.log('🤖 API snippets extraction:', extracted);
                
                const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                const dateMatch = extracted.match(datePattern);
                
                if (dateMatch) {
                  // Find which snippet contained the date
                  const dateStr = dateMatch[0];
                  let sourceFound = false;
                  
                  for (const result of searchResults) {
                    const snippetText = `${result.title} ${result.snippet || ''}`;
                    if (snippetText.toLowerCase().includes(dateStr.toLowerCase()) ||
                        snippetText.match(/march\s+12|12\s+march/i) ||
                        snippetText.match(new RegExp(dateStr.replace(/,?\s+\d{4}/, ''), 'i'))) {
                      console.log('📍 Date source found:');
                      console.log('   Title:', result.title);
                      console.log('   URL:', result.link);
                      console.log('   Snippet:', result.snippet?.substring(0, 200));
                      sourceFound = true;
                      break;
                    }
                  }
                  
                  if (!sourceFound) {
                    console.log('⚠️ Date source not found in snippets - AI may have inferred from context');
                    console.log('   First result:', searchResults[0]?.title, '-', searchResults[0]?.link);
                  }
                  
                  eventDates.push({ eventName: event.name, date: dateMatch[0] });
                  methodUsed = 'API Snippets';
                  console.log('✅ SUCCESS via API Snippets:', dateMatch[0]);
                  dateFound = true;
                }
              }
            }
          }

          if (dateFound) {
            break; // Exit query retry loop
          }

          // Add delay between query attempts
          if (queryIndex < queries.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // METHOD 4: Gemini direct knowledge (last resort)
        if (!dateFound) {
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
              methodUsed = 'Direct Knowledge';
              console.log('✅ SUCCESS via direct knowledge:', dateMatch[0]);
              dateFound = true;
            }
          }
        }

        if (!dateFound) {
          eventDates.push({ eventName: event.name, date: null });
          console.log('❌ NO DATE FOUND after all methods and retries');
        } else {
          console.log(`✨ Final result: Successfully extracted via ${methodUsed}`);
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
