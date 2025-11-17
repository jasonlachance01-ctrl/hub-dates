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
        const query = `${organizationName} ${event.name} date ${currentYear} ${nextYear}`;
        console.log('Search Query:', query);

        // PRIORITY METHOD: Extract AI Overview from Google Search
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=us&hl=en`;
        console.log('🔍 Fetching Google Search page for AI Overview...');
        
        try {
          const pageResponse = await fetch(googleSearchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Cache-Control': 'max-age=0'
            }
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            console.log('✓ Successfully fetched Google Search page, length:', html.length);
            
            // Extract comprehensive AI Overview content
            let aiOverviewText = '';
            
            // Multiple extraction strategies for AI Overview
            // Strategy 1: Look for AI Overview container divs
            const aiContainerPatterns = [
              // Modern AI Overview (2024+)
              /<div[^>]*data-attrid="wa:\/description"[^>]*>([\s\S]*?)<\/div>/gi,
              /<div[^>]*class="[^"]*hgKElc[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
              /<div[^>]*class="[^"]*kno-rdesc[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
              /<div[^>]*class="[^"]*mod[^"]*"[^>]*data-md="[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
              // Featured snippet patterns
              /<div[^>]*class="[^"]*IZ6rdc[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
              /<span[^>]*class="[^"]*hgKElc[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
            ];
            
            for (const pattern of aiContainerPatterns) {
              const matches = html.matchAll(pattern);
              for (const match of matches) {
                if (match && match[1]) {
                  const extracted = match[1]
                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  if (extracted.length > 50 && extracted.length < 5000) {
                    aiOverviewText += extracted + '\n\n';
                  }
                }
              }
            }
            
            // Strategy 2: Look for any content with date keywords
            const dateKeywordRegex = /(<div[^>]*>[\s\S]*?(?:January|February|March|April|May|June|July|August|September|October|November|December)[^<]*\d{1,2}[^<]*\d{4}[\s\S]*?<\/div>)/gi;
            const dateMatches = html.matchAll(dateKeywordRegex);
            
            for (const match of dateMatches) {
              if (match && match[1]) {
                const extracted = match[1]
                  .replace(/<script[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (extracted.length > 20 && extracted.length < 1000) {
                  aiOverviewText += extracted + '\n';
                }
              }
            }
            
            if (aiOverviewText) {
              console.log('📄 Extracted AI Overview content, length:', aiOverviewText.length);
              console.log('📝 Preview:', aiOverviewText.substring(0, 300));
              
              // Use Gemini to extract date from AI Overview
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
                      content: `You are a date extraction expert analyzing Google Search AI Overview content.

EVENT: ${event.name}
ORGANIZATION: ${organizationName}
TARGET YEARS: ${currentYear}-${nextYear}

CONTENT TO ANALYZE:
${aiOverviewText}

CRITICAL EXTRACTION RULES:
1. Extract ONLY dates for ${currentYear} or ${nextYear}
2. If there's a date range (e.g., "May 16-17, 2025"), return it as: "May 16, 2025 - May 17, 2025"
3. If there's a single date, return it as: "Month Day, Year"
4. PRIORITIZE dates that explicitly mention "${event.name}"
5. If multiple dates found, choose the LATEST one in ${nextYear}
6. If NO valid date found for ${currentYear}/${nextYear}, respond with exactly: "NOT_FOUND"

Return ONLY the date or "NOT_FOUND", nothing else.

Date:`
                    }
                  ],
                  max_tokens: 60
                }),
              });

              if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
                
                console.log('🤖 Gemini extracted from AI Overview:', extracted);
                
                if (extracted !== 'NOT_FOUND' && extracted.length > 0) {
                  const dateRangePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                  const singleDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
                  const dateMatch = extracted.match(dateRangePattern) || extracted.match(singleDatePattern);
                  
                  if (dateMatch) {
                    eventDates.push({ eventName: event.name, date: dateMatch[0] });
                    console.log('✅ SUCCESS via AI Overview for', event.name, ':', dateMatch[0]);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                  }
                }
              } else {
                console.error('❌ Gemini API error:', await extractResponse.text());
              }
            } else {
              console.log('⚠️ No AI Overview content found in HTML');
            }
          } else {
            console.error('❌ Failed to fetch Google page, status:', pageResponse.status);
          }
        } catch (scrapeError) {
          console.error('❌ Error scraping Google page:', scrapeError);
        }


        // FALLBACK METHOD 2: Google Search API
        console.log('📡 Trying Google Search API as fallback...');
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.items && searchData.items.length > 0) {
            // Extract comprehensive search context
            let searchContext = '';
            
            searchContext += searchData.items.slice(0, 10)
              .map((item: any) => {
                let itemText = `Title: ${item.title}\nURL: ${item.link}\n`;
                if (item.snippet) itemText += `Snippet: ${item.snippet}\n`;
                if (item.htmlSnippet) {
                  const cleanHtml = item.htmlSnippet.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  if (cleanHtml !== item.snippet) itemText += `Extended: ${cleanHtml}\n`;
                }
                return itemText;
              })
              .join('\n---\n\n');
            
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
                    content: `Extract date for "${event.name}" at ${organizationName}:

${searchContext}

Rules:
- Only ${currentYear} or ${nextYear} dates
- Range format: "Month Day, Year - Month Day, Year"
- Single format: "Month Day, Year"
- Return "NOT_FOUND" if no date found

Date:`
                  }
                ],
                max_tokens: 50
              }),
            });

            if (extractResponse.ok) {
              const extractData = await extractResponse.json();
              const extracted = extractData.choices?.[0]?.message?.content?.trim() || '';
              
              console.log('🤖 Gemini from API results:', extracted);
              
              const dateRangePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i;
              const singleDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i;
              const dateMatch = extracted.match(dateRangePattern) || extracted.match(singleDatePattern);
              
              if (dateMatch) {
                eventDates.push({ eventName: event.name, date: dateMatch[0] });
                console.log('✅ SUCCESS via API fallback for', event.name, ':', dateMatch[0]);
                await new Promise(resolve => setTimeout(resolve, 700));
                continue;
              }
            }
          }
        }

        // FALLBACK METHOD 3: Gemini direct knowledge
        
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

        // FALLBACK METHOD 3: Gemini direct knowledge
        console.log('🧠 Trying Gemini direct knowledge as final fallback...');
        
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
- Provide ONLY the LATER date if multiple years exist (prefer ${nextYear})
- Range format: "Month Day, Year - Month Day, Year"
- Single format: "Month Day, Year"
- If unknown, respond with exactly "NOT_FOUND"

Date:`
              }
            ],
            max_tokens: 50
          }),
        });

        if (directResponse.ok) {
          const directData = await directResponse.json();
          const answer = directData.choices?.[0]?.message?.content?.trim() || '';
          
          console.log('🤖 Gemini direct knowledge:', answer);
          
          const dateRangePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\s*-\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const singleDatePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;
          const dateMatch = answer.match(dateRangePattern) || answer.match(singleDatePattern);
          
          if (dateMatch) {
            eventDates.push({ eventName: event.name, date: dateMatch[0] });
            console.log('✅ SUCCESS via direct knowledge for', event.name, ':', dateMatch[0]);
          } else {
            eventDates.push({ eventName: event.name, date: null });
            console.log('❌ NO DATE FOUND for', event.name);
          }
        } else {
          const errorText = await directResponse.text();
          console.error('❌ Gemini request failed for', event.name, ':', errorText);
          eventDates.push({ eventName: event.name, date: null });
        }

        // Rate limit protection
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
