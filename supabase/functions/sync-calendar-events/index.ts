import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, events } = await req.json();
    
    if (!accessToken || !events || events.length === 0) {
      throw new Error('Missing access token or events');
    }

    console.log(`Syncing ${events.length} events to Google Calendar...`);

    const results = [];
    
    for (const event of events) {
      try {
        // Parse the date string and create start/end times
        const eventDate = new Date(event.date);
        const endDate = new Date(eventDate);
        endDate.setHours(endDate.getHours() + 1); // Default 1-hour duration

        const calendarEvent = {
          summary: event.name,
          description: `Event from ${event.organizationName}`,
          start: {
            dateTime: eventDate.toISOString(),
            timeZone: 'America/New_York', // You can make this configurable
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: 'America/New_York',
          },
        };

        console.log('Creating event:', calendarEvent.summary);

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calendarEvent),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`Failed to create event ${event.name}:`, error);
          results.push({ event: event.name, success: false, error });
        } else {
          const created = await response.json();
          console.log(`Successfully created event: ${event.name}`);
          results.push({ event: event.name, success: true, id: created.id });
        }
      } catch (error) {
        console.error(`Error creating event ${event.name}:`, error);
        results.push({ 
          event: event.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Successfully synced ${successCount}/${events.length} events`);

    return new Response(
      JSON.stringify({ results, successCount, totalCount: events.length }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error syncing events:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
