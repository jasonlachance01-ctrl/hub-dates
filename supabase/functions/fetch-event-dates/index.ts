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
        // Form Google Search query first
        const query = `When is ${event.name} for ${organizationName}`;
        
        // First, try to scrape Google's AI Overview by fetching the search page directly
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        console.log('Fetching Google Search page for AI Overview:', query);
        
        let aiOverview = '';
        try {
          const searchPageResponse = await fetch(googleSearchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          const searchPageHtml = await searchPageResponse.text();
          
          // Look for AI Overview content - it's typically in a specific div
          // AI Overview usually appears in elements with data-attrid or specific classes
          const aiOverviewMatch = searchPageHtml.match(/<div[^>]*data-attrid="SGFQTitle"[^>]*>[\s\S]*?<\/div>/i) ||
                                  searchPageHtml.match(/<div[^>]*class="[^"]*kp-blk[^"]*"[^>]*>[\s\S]*?<\/div>/i);
          
          if (aiOverviewMatch) {
            aiOverview = aiOverviewMatch[0]
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 1000);
            console.log('Found AI Overview snippet for', event.name);
          }
        } catch (error) {
          console.log('Could not fetch AI Overview, continuing with regular search:', error);
        }

        // If we found AI Overview content, try to extract date from it first
        if (aiOverview && aiOverview.length > 20) {
          console.log('Using AI Overview content for', event.name);
          
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
                  content: `Extract the date from Google's AI Overview. Return ONLY the date in "Month Day, Year" format. If no date found, return "Date not found".`
                },
                {
                  role: 'user',
                  content: `Event: ${event.name}\nOrganization: ${organizationName}\n\nGoogle AI Overview:\n${aiOverview}\n\nWhat is the date?`
                }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_date",
                    description: "Extract the event date",
                    parameters: {
                      type: "object",
                      properties: {
                        date: { type: "string" }
                      },
                      required: ["date"]
                    }
                  }
                }
              ],
              tool_choice: { type: "function", function: { name: "extract_date" } }
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            const dateStr = toolCall ? JSON.parse(toolCall.function.arguments).date : null;
            
            if (dateStr && dateStr !== 'Date not found') {
              eventDates.push({ eventName: event.name, date: dateStr });
              console.log('Found date from AI Overview for', event.name, ':', dateStr);
              await new Promise(resolve => setTimeout(resolve, 500));
              continue; // Skip regular search if we found it
            }
          }
        }

        // If AI Overview didn't work, fall back to regular Custom Search API
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=3`;

        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
          console.error('Search error for', event.name, ':', searchData);
          eventDates.push({ eventName: event.name, date: null });
          continue;
        }

        // Extract snippets from search results
        const snippets = searchData.items?.map((item: any) => item.snippet).join('\n') || '';

        // Get the top URLs from search results
        const topUrls = searchData.items?.slice(0, 2).map((item: any) => item.link) || [];
        
        if (topUrls.length === 0) {
          console.log('No URLs found for', event.name);
          eventDates.push({ eventName: event.name, date: null });
          continue;
        }

        // Fetch and parse the actual web pages
        let pageContent = '';
        for (const url of topUrls) {
          try {
            console.log('Fetching page:', url);
            const pageResponse = await fetch(url);
            const html = await pageResponse.text();
            
            // Extract text content from HTML (simple approach)
            const textContent = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            pageContent += textContent.slice(0, 5000) + '\n\n';
          } catch (error) {
            console.error('Error fetching page:', url, error);
          }
        }

        if (!pageContent) {
          console.log('Could not fetch page content for', event.name);
          eventDates.push({ eventName: event.name, date: null });
          continue;
        }

        // Use AI to extract the date from full page content
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
                content: `You are a date extraction expert. Your task is to find and extract dates from search results about school events.
                
Rules:
- Look for specific dates in formats like "May 15, 2025", "5/15/25", "May 15", etc.
- Look for date ranges like "March 10-14" or "December 20 - January 3"
- Convert relative dates (like "next Monday" or "in 2 weeks") to actual dates if possible
- For date ranges, return the START date
- If you find a date, return it in "Month Day, Year" format (e.g., "May 15, 2025")
- If you cannot find ANY date information, return "Date not found"
- Be generous in your interpretation - any mention of a date related to the event counts`
              },
              {
                role: 'user',
                content: `Find the date for this event:

Event: ${event.name}
School/Organization: ${organizationName}

Full Page Content from Top Search Results:
${pageContent}

Extract the date if you can find it.`
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

        // If Google Search didn't find a date, try asking GPT-5 directly
        if (!dateStr || dateStr === 'Date not found') {
          console.log('Google Search failed, trying GPT-5 directly for', event.name);

          const gptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                  content: `You are an expert on school calendars and academic schedules. Provide specific dates when asked about school events.
                  
Rules:
- Return dates in "Month Day, Year" format (e.g., "May 15, 2025")
- For recurring events, provide the most recent or upcoming date
- If you know typical patterns (e.g., "Spring break is usually mid-March"), provide that
- If you truly don't know, return "Date not found"
- Be specific and confident when you do know`
                },
                {
                  role: 'user',
                  content: `When is ${event.name} for ${organizationName}? Provide the specific date.`
                }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_date",
                    description: "Provide the event date",
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

          if (gptResponse.ok) {
            const gptData = await gptResponse.json();
            const gptToolCall = gptData.choices?.[0]?.message?.tool_calls?.[0];
            const gptDateStr = gptToolCall ? JSON.parse(gptToolCall.function.arguments).date : null;
            
            if (gptDateStr && gptDateStr !== 'Date not found') {
              eventDates.push({ eventName: event.name, date: gptDateStr });
              console.log('GPT-5 found date for', event.name, ':', gptDateStr);
            } else {
              eventDates.push({ eventName: event.name, date: null });
              console.log('GPT-5 also could not find date for', event.name);
            }
          } else {
            eventDates.push({ eventName: event.name, date: null });
            console.log('GPT-5 request failed for', event.name);
          }
        } else {
          eventDates.push({ eventName: event.name, date: dateStr });
          console.log('Google Search found date for', event.name, ':', dateStr);
        }

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
