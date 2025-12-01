import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const LOOPS_API_KEY = Deno.env.get("LOOPS_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  transactionalId: string;
  email: string;
  dataVariables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    contentType: string;
    data: string; // base64 encoded content
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactionalId, email, dataVariables, attachments }: SendEmailRequest = await req.json();

    console.log("Sending transactional email via Loops:", { transactionalId, email, hasAttachments: !!attachments });

    const requestBody: any = {
      transactionalId,
      email,
      dataVariables: dataVariables || {},
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      requestBody.attachments = attachments;
    }

    const response = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOOPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Loops API error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Failed to send email" }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-loops-email function:", error);
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
