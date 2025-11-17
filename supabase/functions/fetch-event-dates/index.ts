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

// Add timeout wrapper for fetch operations
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

// Validate date is in the future and not a past date
function isValidFutureDate(dateStr: string, currentYear: number): boolean {
  try {
    // Parse various date formats
    let parsedDate: Date;
    
    // Handle "Month Day, Year" format
    if (/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i.test(dateStr)) {
      parsedDate = new Date(dateStr);
    }
    // Handle "M/D/YYYY" format
    else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) {
      const [month, day, year] = dateStr.split('/').map(n => parseInt(n));
      parsedDate = new Date(year, month - 1, day);
    } else {
      return false;
    }
    
    const now = new Date();
    const yearFromDate = parsedDate.getFullYear();
    
    // Reject if date is in the past or more than 2 years in the future
    if (parsedDate < now || yearFromDate < currentYear || yearFromDate > currentYear + 2) {
      console.log('⚠️ Rejected date (past or too far future):', dateStr);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Check if domain should be rejected (irrelevant sources)
function isRelevantDomain(url: string): boolean {
  const rejectedDomains = [
    'eliteprospects.com',
    'espn.com',
    'wikipedia.org',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'reddit.com',
    'youtube.com',
    'linkedin.com',
  ];
  
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Reject if matches blacklist
    if (rejectedDomains.some(rejected => domain.includes(rejected))) {
      console.log('⚠️ Rejected irrelevant domain:', domain);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
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
    const startTime = Date.now();
    const MAX_PROCESSING_TIME = 25000; // 25 seconds max to avoid timeout

    for (const event of events) {
      // Check if we're running out of time
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log('⏱️ Time limit approaching, returning partial results');
        break;
      }

      try {
        // event is a string (event name), not an object
        const eventName = typeof event === 'string' ? event : event.name;
        
        // Map event names to include alternative search terms
        const eventSearchTerms = eventName === "Graduation" 
          ? ["Graduation", "Commencement"]
          : [eventName];
        
        const eventTermDescription = eventSearchTerms.join(" or ");
        
        // Build comprehensive search queries with .edu prioritization and academic keywords
        // Limit to 3 queries per event to stay within compute limits
        const queries: string[] = [];
        for (const term of eventSearchTerms) {
          queries.push(
            // Primary: .edu sites with academic calendar keywords
            `${organizationName} academic calendar ${term} ${nextYear} site:*.edu`,
            // Secondary: .edu sites with date keywords
            `${organizationName} ${term} date ${currentYear} ${nextYear} site:*.edu`,
            // Fallback: broader search if .edu doesn't yield results
            `${organizationName} academic calendar ${term} ${nextYear}`,
          );
        }
        
        let dateFound = false;
        let queryIndex = 0;

        while (!dateFound && queryIndex < queries.length) {
          if (Date.now() - startTime > MAX_PROCESSING_TIME) {
            console.log('⏱️ Time limit approaching, stopping event search');
            break;
          }

          const query = queries[queryIndex];
          console.log(`🔍 Search Query (attempt ${queryIndex + 1}/${queries.length}):`, query);
          queryIndex++;

          // METHOD 1: Try Google Search scraping for AI Overview and featured content
          try {
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`;
            const pageResponse = await fetchWithTimeout(googleSearchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'en-US,en;q=0.9',
              }
            }, 5000); // 5 second timeout
            
            if (pageResponse.ok) {
              const html = await pageResponse.text();
              console.log('✓ Fetched Google page, length:', html.length);
              
              if (html.length > 5000) {
                // Extract date contexts - 300 chars before and after dates
                const spelledDateRegex = /.{0,300}(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}.{0,300}/gi;
                const numericalDateRegex = /.{0,300}\d{1,2}\/\d{1,2}\/\d{4}.{0,300}/gi;
                
                const spelledDates = html.match(spelledDateRegex) || [];
                const numericalDates = html.match(numericalDateRegex) || [];
                const allDateText = [...spelledDates, ...numericalDates];
                
                if (allDateText.length > 0) {
                  // Take up to 8 matches to keep AI processing fast
                  const aiOverviewText = allDateText.slice(0, 8).join('\n\n---\n\n');
                  console.log('📄 Extracted date contexts, segments:', allDateText.length);
                  
                  const extractResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${lovableApiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'google/gemini-2.5-flash-lite', // Use lite for faster processing
                      messages: [
                        {
                          role: 'system',
                          content: `You are a date extractor. Look for the ${eventTermDescription} date for ${organizationName}. Only extract dates from ${currentYear} or ${nextYear}. Return ONLY the date in format "Month Day, Year" (e.g., "May 16, 2026") or "M/D/YYYY" (e.g., "3/13/2026"). Return "NOT_FOUND" if not found.`
                        },
                        {
                          role: 'user',
                          content: `Find the ${eventTermDescription} date:\n\n${aiOverviewText}`
                        }
                      ],
                      max_tokens: 50
                    }),
                  }, 7000); // 7 second timeout for AI

                  if (extractResponse.ok) {
                    const extractData = await extractResponse.json();
                    const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                    console.log('🤖 AI extraction:', extracted);
                    
                    const spelledDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                    const numericalDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}/i;
                    
                      const dateMatch = extracted.match(spelledDatePattern) || extracted.match(numericalDatePattern);
                      
                      if (dateMatch && isValidFutureDate(dateMatch[0], currentYear)) {
                        eventDates.push({ eventName, date: dateMatch[0] });
                        console.log('✅ SUCCESS via Google Search:', dateMatch[0], 'from', googleSearchUrl);
                        dateFound = true;
                      }
                  }
                }
              }
            }
          } catch (e) {
            console.log('⚠️ Google scraping failed:', (e as Error).message || 'Unknown error');
          }

          if (dateFound) {
            break;
          }

          // METHOD 2A: Try PDF parsing if URL points to a PDF
          if (!dateFound) {
            try {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
              const searchResponse = await fetchWithTimeout(searchUrl, {}, 5000);
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  // Check for PDF files in results - filter by domain relevance
                  for (const item of searchData.items) {
                    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
                      break;
                    }

                    // Skip irrelevant domains
                    if (!isRelevantDomain(item.link)) {
                      continue;
                    }

                    const isPDF = item.link?.toLowerCase().endsWith('.pdf') || 
                                  item.mime?.includes('pdf');
                    
                    if (isPDF) {
                      console.log('📄 Found PDF:', item.link);
                      
                      try {
                        // Fetch PDF with size limit (max 5MB to prevent memory issues)
                        const pdfResponse = await fetchWithTimeout(item.link, {}, 10000);
                        
                        if (pdfResponse.ok) {
                          const contentLength = pdfResponse.headers.get('content-length');
                          const sizeInMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;
                          
                          if (sizeInMB > 5) {
                            console.log('⚠️ PDF too large:', sizeInMB, 'MB - skipping');
                            continue;
                          }

                          const pdfBlob = await pdfResponse.blob();
                          const arrayBuffer = await pdfBlob.arrayBuffer();
                          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                          
                          console.log('📄 PDF fetched, size:', sizeInMB.toFixed(2), 'MB');
                          
                          // Use vision model to extract text from PDF
                          const extractResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${lovableApiKey}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              model: 'google/gemini-2.5-flash-lite',
                              messages: [
                                {
                                  role: 'system',
                                  content: `Extract the ${eventTermDescription} date for ${organizationName} from ${currentYear} or ${nextYear}. Return ONLY the date in format "Month Day, Year" or "M/D/YYYY". Return "NOT_FOUND" if not found.`
                                },
                                {
                                  role: 'user',
                                  content: [
                                    {
                                      type: 'text',
                                      text: `Find the ${eventTermDescription} date in this PDF from ${item.link}`
                                    },
                                    {
                                      type: 'image_url',
                                      image_url: {
                                        url: `data:application/pdf;base64,${base64}`
                                      }
                                    }
                                  ]
                                }
                              ],
                              max_tokens: 50
                            }),
                          }, 10000);

                          if (extractResponse.ok) {
                            const extractData = await extractResponse.json();
                            const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                            console.log('🤖 PDF extraction:', extracted);
                            
                            const spelledDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                            const numericalDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}/i;
                            
                            const dateMatch = extracted.match(spelledDatePattern) || extracted.match(numericalDatePattern);
                            
                            if (dateMatch && isValidFutureDate(dateMatch[0], currentYear)) {
                              eventDates.push({ eventName, date: dateMatch[0] });
                              console.log('✅ SUCCESS via PDF:', dateMatch[0], 'from', item.link);
                              dateFound = true;
                              break;
                            }
                          }
                        }
                      } catch (e) {
                        console.log('⚠️ PDF parsing failed:', (e as Error).message || 'Unknown error');
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ PDF search failed:', (e as Error).message || 'Unknown error');
            }
          }

          if (dateFound) {
            break;
          }

          // METHOD 2B: Try full webpage HTML parsing
          if (!dateFound) {
            try {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=3`;
              const searchResponse = await fetchWithTimeout(searchUrl, {}, 5000);
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  // Try fetching and parsing the top non-PDF result - filter by domain relevance
                  for (const item of searchData.items) {
                    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
                      break;
                    }

                    // Skip irrelevant domains
                    if (!isRelevantDomain(item.link)) {
                      continue;
                    }

                    const isPDF = item.link?.toLowerCase().endsWith('.pdf') || 
                                  item.mime?.includes('pdf');
                    
                    if (!isPDF) {
                      try {
                        console.log('🌐 Fetching webpage:', item.link);
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
                            const numericalDateRegex = /.{0,300}\d{1,2}\/\d{1,2}\/\d{4}.{0,300}/gi;
                            
                            const spelledDates = html.match(spelledDateRegex) || [];
                            const numericalDates = html.match(numericalDateRegex) || [];
                            const allDateText = [...spelledDates, ...numericalDates];
                            
                            if (allDateText.length > 0) {
                              const aiContext = allDateText.slice(0, 8).join('\n\n---\n\n');
                              
                              const extractResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${lovableApiKey}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  model: 'google/gemini-2.5-flash-lite',
                                  messages: [
                                    {
                                      role: 'system',
                                      content: `Extract the ${eventTermDescription} date for ${organizationName} from ${currentYear} or ${nextYear}. Return ONLY the date or "NOT_FOUND".`
                                    },
                                    {
                                      role: 'user',
                                      content: aiContext
                                    }
                                  ],
                                  max_tokens: 50
                                }),
                              }, 7000);

                              if (extractResponse.ok) {
                                const extractData = await extractResponse.json();
                                const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                                
                                const spelledDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                                const numericalDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}/i;
                                
                                const dateMatch = extracted.match(spelledDatePattern) || extracted.match(numericalDatePattern);
                                
                                if (dateMatch && isValidFutureDate(dateMatch[0], currentYear)) {
                                  eventDates.push({ eventName, date: dateMatch[0] });
                                  console.log('✅ SUCCESS via HTML:', dateMatch[0], 'from', item.link);
                                  dateFound = true;
                                  break;
                                }
                              }
                            }
                          }
                        }
                      } catch (e) {
                        console.log('⚠️ Webpage parsing failed:', (e as Error).message || 'Unknown error');
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ HTML search failed:', (e as Error).message || 'Unknown error');
            }
          }

          if (dateFound) {
            break;
          }

          // METHOD 3: Try Google Custom Search API snippets
          if (!dateFound) {
            try {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=3`;
              const searchResponse = await fetchWithTimeout(searchUrl, {}, 5000);
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                
                if (searchData.items && searchData.items.length > 0) {
                  // Combine snippets from top 3 results and track URLs
                  const snippets = searchData.items
                    .map((item: any) => item.snippet)
                    .filter((s: string) => s)
                    .join('\n\n');
                  
                  const sourceUrls = searchData.items
                    .map((item: any) => item.link)
                    .filter((url: string) => url)
                    .join(', ');
                  
                  console.log('📄 Google API snippets, length:', snippets.length);
                  
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
                          {
                            role: 'system',
                            content: `Extract the ${eventTermDescription} date for ${organizationName} from ${currentYear} or ${nextYear}. Return ONLY the date or "NOT_FOUND".`
                          },
                          {
                            role: 'user',
                            content: snippets
                          }
                        ],
                        max_tokens: 50
                      }),
                    }, 7000);

                    if (extractResponse.ok) {
                      const extractData = await extractResponse.json();
                      const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                      console.log('🤖 API snippets extraction:', extracted);
                      
                      const spelledDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                      const numericalDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}/i;
                            
                            const dateMatch = extracted.match(spelledDatePattern) || extracted.match(numericalDatePattern);
                            
                            if (dateMatch && isValidFutureDate(dateMatch[0], currentYear)) {
                              eventDates.push({ eventName, date: dateMatch[0] });
                              console.log('✅ SUCCESS via API snippets:', dateMatch[0], 'from', sourceUrls);
                              dateFound = true;
                            }
                    }
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ API search failed:', (e as Error).message || 'Unknown error');
            }
          }
        }

        // If no date found after all attempts, add null entry
        if (!dateFound) {
          eventDates.push({ eventName, date: null });
          console.log('❌ No date found for:', eventName);
        }

      } catch (error) {
        const eventName = typeof event === 'string' ? event : event.name;
        console.error(`Error processing event ${eventName}:`, error);
        eventDates.push({ eventName, date: null });
      }
    }

    return new Response(
      JSON.stringify({ eventDates }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Request error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});