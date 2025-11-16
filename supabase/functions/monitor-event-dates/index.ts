import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting event date monitoring...");

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all events that need monitoring (date_found is null)
    const { data: eventsToMonitor, error: fetchError } = await supabase
      .from('event_monitoring')
      .select('*')
      .is('date_found', null)
      .order('last_checked', { ascending: true })
      .limit(50); // Process max 50 events per run to avoid timeouts

    if (fetchError) {
      console.error("Error fetching events to monitor:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${eventsToMonitor?.length || 0} events to monitor`);

    if (!eventsToMonitor || eventsToMonitor.length === 0) {
      return new Response(
        JSON.stringify({ message: "No events to monitor", checked: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group events by organization to make fewer API calls
    const eventsByOrg = eventsToMonitor.reduce((acc, event) => {
      if (!acc[event.organization_name]) {
        acc[event.organization_name] = [];
      }
      acc[event.organization_name].push(event.event_name);
      return acc;
    }, {} as Record<string, string[]>);

    let foundDates = 0;

    // Process each organization
    for (const [orgName, eventNames] of Object.entries(eventsByOrg)) {
      const events = eventNames as string[];
      console.log(`Checking dates for ${orgName} - ${events.length} events`);
      
      try {
        // Call the fetch-event-dates function
        const fetchResponse = await fetch(
          `${supabaseUrl}/functions/v1/fetch-event-dates`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              organizationName: orgName,
              events: events,
            }),
          }
        );

        if (!fetchResponse.ok) {
          console.error(`Error fetching dates for ${orgName}:`, await fetchResponse.text());
          continue;
        }

        const { eventDates } = await fetchResponse.json();

        // Update database with any found dates
        for (const eventDate of eventDates) {
          if (eventDate.date) {
            console.log(`Found date for ${orgName} - ${eventDate.event}: ${eventDate.date}`);
            
            const { error: updateError } = await supabase
              .from('event_monitoring')
              .update({
                date_found: eventDate.date,
                last_checked: new Date().toISOString(),
                notification_sent: false, // Mark for notification
              })
              .eq('organization_name', orgName)
              .eq('event_name', eventDate.event);

            if (updateError) {
              console.error(`Error updating event ${eventDate.event}:`, updateError);
            } else {
              foundDates++;
            }
          } else {
            // Update last_checked even if no date found
            await supabase
              .from('event_monitoring')
              .update({ last_checked: new Date().toISOString() })
              .eq('organization_name', orgName)
              .eq('event_name', eventDate.event);
          }
        }
      } catch (error) {
        console.error(`Error processing ${orgName}:`, error);
      }
    }

    console.log(`Monitoring complete. Found ${foundDates} new dates.`);

    return new Response(
      JSON.stringify({
        message: "Monitoring complete",
        checked: eventsToMonitor.length,
        foundDates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in monitor-event-dates function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
