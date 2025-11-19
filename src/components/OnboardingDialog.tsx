import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateICalendarFile, downloadICalendarFile } from "@/lib/calendarUtils";
import { Organization } from "@/types";
import EmailPromptDialog from "./EmailPromptDialog";

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  onStarterPlanSelect: () => void;
  pendingOrg: Organization | null;
}

const OnboardingDialog = ({
  open,
  onClose,
  onConnect,
  onStarterPlanSelect,
  pendingOrg
}: OnboardingDialogProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);

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


  const handleStarterPlan = () => {
    if (!pendingOrg) {
      toast.error("No organization selected");
      return;
    }

    const selectedEvents = pendingOrg.events.filter(e => e.addedToCalendar);
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event to sync");
      return;
    }

    // Check 1-organization limit for Starter Plan
    const syncedOrgs = JSON.parse(localStorage.getItem('syncedOrganizations') || '[]');
    if (!syncedOrgs.includes(pendingOrg.id) && syncedOrgs.length >= 1) {
      toast.error("To add dates for more than one organization upgrade to the Step Up Plan.");
      return;
    }

    // Check if this is the first sync and user hasn't provided email
    const userEmail = localStorage.getItem('userEmail');
    if (syncedOrgs.length === 0 && !userEmail) {
      setShowEmailPrompt(true);
      return;
    }

    proceedWithDownload();
  };

  const proceedWithDownload = () => {
    if (!pendingOrg) return;

    const selectedEvents = pendingOrg.events.filter(e => e.addedToCalendar);
    const syncedOrgs = JSON.parse(localStorage.getItem('syncedOrganizations') || '[]');

    // Generate and download .ics file
    try {
      const icsContent = generateICalendarFile(pendingOrg.name, selectedEvents);
      downloadICalendarFile(pendingOrg.name, icsContent);
      
      // Track this organization as synced
      if (!syncedOrgs.includes(pendingOrg.id)) {
        syncedOrgs.push(pendingOrg.id);
        localStorage.setItem('syncedOrganizations', JSON.stringify(syncedOrgs));
      }

      toast.success("Calendar file downloaded! Open it to add events to your calendar.");
      onStarterPlanSelect();
      onClose();
    } catch (error) {
      console.error("Error generating calendar file:", error);
      toast.error("Failed to generate calendar file. Please try again.");
    }
  };

  const handleEmailSubmit = (email: string) => {
    setShowEmailPrompt(false);
    proceedWithDownload();
  };

  const handleStepUp = () => {
    toast.info("Payment processing coming soon!");
  };

  return (
    <>
      <EmailPromptDialog
        open={showEmailPrompt}
        onEmailSubmit={handleEmailSubmit}
        onClose={() => setShowEmailPrompt(false)}
      />
      
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[88vw] max-w-[420px] mx-auto sm:w-full sm:max-w-lg md:max-w-2xl p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center flex-shrink-0">
            <img src="/icon-option-6-blue.png" alt="App Icon" className="w-full h-full rounded-2xl" />
          </div>
          <DialogTitle className="text-center text-sm sm:text-base md:text-lg leading-snug break-words hyphens-auto px-2">
            You are almost to the most effortless and rewarding calendar management you have ever experienced! You will never miss your important dates.
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pb-2 sm:pb-3 overflow-y-auto max-h-[50vh]">
          {/* Starter Plan */}
          <div className="space-y-2">
            <h3 className="text-center font-bold text-sm sm:text-base md:text-lg text-foreground">
              Starter Plan - Free
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes <strong>one</strong> school selection in your feed.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Begin your Starter plan now by syncing your already selected event dates. Just hit the Connect Calendar Now button to sync events. Or return to your home screen to select a different school.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes notifications of changes or new events to your feed selections.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes free version of Calsync in-app personal calendar. *Not available in Beta.
                </p>
              </div>
            </div>
          </div>

          {/* Step Up Plan */}
          <div className="space-y-2">
            <h3 className="text-center font-bold text-sm sm:text-base md:text-lg text-foreground">
              Step Up Plan - $25/year
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes <strong>unlimited</strong> school selections in your feed.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes option to add <strong>athletic team schedules</strong> for your selected schools.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  <strong>Share</strong> your saved event dates with family and friends.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes notifications of changes or new events to your feed selections.
                </p>
              </div>
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-accent/5">
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground flex-1 break-words leading-snug">
                  Includes free version of Calsync in-app personal calendar. *Not available in Beta.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 pt-2">
          <Button 
            onClick={handleStepUp}
            className="w-full text-[11px] sm:text-xs md:text-sm leading-tight py-2.5 sm:py-2 md:py-2.5 h-auto px-2"
          >
            <span className="break-words text-center w-full">
              Upgrade to unlimited feed selections with Step Up Plan
            </span>
          </Button>
          <Button 
            onClick={handleStarterPlan} 
            className="w-full text-[11px] sm:text-xs leading-tight py-2.5 sm:py-2 h-auto px-2"
          >
            <span className="break-words text-center w-full">
              Connect Calendar Now with FREE Starter Plan
            </span>
          </Button>
          <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground text-center w-full pt-2">
            All data stays private and secure
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default OnboardingDialog;
