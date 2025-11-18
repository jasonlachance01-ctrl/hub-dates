import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GoogleCalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        setStatus("error");
        toast.error("Authorization failed. Please try again.");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      if (!code) {
        console.error("No authorization code received");
        setStatus("error");
        toast.error("No authorization code received");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      try {
        console.log("Exchanging authorization code for tokens...");
        
        const redirectUri = `${window.location.origin}/google-calendar-callback`;
        
        const { data, error: callbackError } = await supabase.functions.invoke(
          "google-calendar-callback",
          {
            body: { code, redirectUri },
          }
        );

        if (callbackError) {
          throw callbackError;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        console.log("Successfully obtained access token");
        
        // Store tokens in localStorage
        localStorage.setItem("googleCalendarAccessToken", data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem("googleCalendarRefreshToken", data.refreshToken);
        }
        localStorage.setItem("calendarConnected", "true");

        setStatus("success");
        toast.success("Calendar connected successfully!");
        
        // Redirect back to home page
        setTimeout(() => navigate("/"), 2000);
      } catch (err) {
        console.error("Error in callback:", err);
        setStatus("error");
        toast.error("Failed to connect calendar. Please try again.");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto">
          <img src="/icon-option-6-blue.png" alt="App Icon" className="w-full h-full rounded-2xl" />
        </div>
        {status === "processing" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-lg text-foreground">Connecting your calendar...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-green-500 text-5xl">✓</div>
            <p className="text-lg text-foreground">Calendar connected successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-destructive text-5xl">✕</div>
            <p className="text-lg text-foreground">Connection failed</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleCalendarCallback;
