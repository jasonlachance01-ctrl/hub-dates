import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const LOOPS_API_KEY = Deno.env.get("LOOPS_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEventRequest {
  email: string;
  eventName: string;
  eventProperties?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, eventName, eventProperties }: SendEventRequest = await req.json();

    console.log("Sending event to Loops:", { eventName, email });

    const response = await fetch("https://app.loops.so/api/v1/events/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOOPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        eventName,
        eventProperties: eventProperties || {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Loops API error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Failed to send event" }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Event sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-loops-event function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
