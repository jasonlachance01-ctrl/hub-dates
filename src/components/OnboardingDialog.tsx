import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
}

const OnboardingDialog = ({
  open,
  onClose,
  onConnect
}: OnboardingDialogProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/google-calendar-callback`;
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        body: { redirectUri }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Error initiating calendar connection:", error);
      toast.error("Failed to connect calendar. Please try again.");
      setIsConnecting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[88vw] max-w-[380px] mx-auto sm:w-full sm:max-w-md p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center flex-shrink-0">
            <img src="/icon-option-6-blue.png" alt="App Icon" className="w-full h-full rounded-2xl" />
          </div>
          <DialogTitle className="text-center text-sm sm:text-base leading-snug break-words hyphens-auto px-2">You are almost to the most effortless and rewarding calendar management you have ever experienced! You will never miss your important dates.</DialogTitle>
        </DialogHeader>

        <div className="text-center font-semibold text-[10px] sm:text-xs text-foreground pt-1 pb-1 px-2 break-words">
          Free Plan Includes feeds from up to two schools or organizations.
        </div>

        <div className="space-y-1.5 sm:space-y-2 pb-2 sm:pb-3 overflow-y-auto max-h-[45vh]">
          <div className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg bg-accent/5">
            <div className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground flex-1 break-words leading-snug">
              Syncs your already selected event dates to your calendar instantly via one time Google authorization. Approve once and you will not have to again.
            </p>
          </div>
          <div className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg bg-accent/5">
            <div className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground flex-1 break-words leading-snug">
              Receive app notifications informing you of changes or new events to your feed selections.
            </p>
          </div>
          <div className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg bg-accent/5">
            <div className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground flex-1 break-words leading-snug">
              Share your saved event dates with family and friends!
            </p>
          </div>
          <div className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg bg-accent/5">
            <div className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground flex-1 break-words leading-snug">
              Receive free version of Calsync in-app calendar! *Not available in Beta.
            </p>
          </div>
          <div className="flex items-start gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-lg bg-accent/5">
            <div className="w-1 h-1 rounded-full bg-primary mt-1 flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground flex-1 break-words leading-snug">
              All data stays private and secure!
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button 
            onClick={handleConnect} 
            className="w-full text-[11px] sm:text-xs leading-tight py-2.5 sm:py-2 h-auto px-2"
            disabled={isConnecting}
          >
            <span className="break-words text-center w-full">
              {isConnecting ? "Connecting..." : "Connect Calendar with one-time Google Authorization"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDialog;
