import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateICalendarFile, downloadICalendarFile } from "@/lib/calendarUtils";
import { Organization } from "@/types";
import EmailPromptDialog from "./EmailPromptDialog";
import FeedbackDialog from "./FeedbackDialog";

// Admin mode helper for testing - checks localStorage flag
const isAdminMode = () => localStorage.getItem('adminMode') === 'true';

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
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  // Check for admin mode URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      localStorage.setItem('adminMode', 'true');
      toast.success("Admin mode enabled - unlimited downloads for testing");
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

    // In admin mode, always treat as first-time user (bypass all checks)
    if (isAdminMode()) {
      proceedWithDownload();
      return;
    }

    // Check 1-organization limit for Starter Plan
    const syncedOrgs = JSON.parse(localStorage.getItem('syncedOrganizations') || '[]');
    if (!syncedOrgs.includes(pendingOrg.id) && syncedOrgs.length >= 1) {
      toast.error("To add dates for more than one organization upgrade to the Graduate Plan.");
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

  const proceedWithDownload = async () => {
    if (!pendingOrg) return;

    const selectedEvents = pendingOrg.events.filter(e => e.addedToCalendar);
    const syncedOrgs = JSON.parse(localStorage.getItem('syncedOrganizations') || '[]');
    const isFirstDownload = syncedOrgs.length === 0;
    const hasGivenFeedback = localStorage.getItem('hasGivenFeedback') === 'true';

    // Generate and download .ics file
    try {
      const icsContent = generateICalendarFile(pendingOrg.name, selectedEvents);
      downloadICalendarFile(pendingOrg.name, icsContent);
      
      // Track this organization as synced
      if (!syncedOrgs.includes(pendingOrg.id)) {
        syncedOrgs.push(pendingOrg.id);
        localStorage.setItem('syncedOrganizations', JSON.stringify(syncedOrgs));
      }

      // Send welcome email via Loops on first download
      if (isFirstDownload) {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
          try {
            // Send event to Loops
            await supabase.functions.invoke("send-loops-event", {
              body: {
                email: userEmail,
                eventName: "first_download",
                eventProperties: {
                  organizationName: pendingOrg.name,
                  eventCount: selectedEvents.length
                }
              }
            });

            // Send welcome email with .ics attachment
            // TODO: Replace with your actual Loops transactional email ID from https://app.loops.so/transactional
            const LOOPS_TRANSACTIONAL_ID = "YOUR_LOOPS_TRANSACTIONAL_ID"; // Replace this with your actual ID
            
            if (LOOPS_TRANSACTIONAL_ID !== "YOUR_LOOPS_TRANSACTIONAL_ID") {
              const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));
              await supabase.functions.invoke("send-loops-email", {
                body: {
                  transactionalId: LOOPS_TRANSACTIONAL_ID,
                  email: userEmail,
                  dataVariables: {
                    organizationName: pendingOrg.name,
                    eventCount: selectedEvents.length
                  },
                  attachments: [{
                    filename: `${pendingOrg.name.replace(/[^a-z0-9]/gi, '-')}-calendar.ics`,
                    contentType: "text/calendar; charset=utf-8",
                    data: icsBase64
                  }]
                }
              });
              
              console.log("Welcome email with .ics attachment sent to Loops");
            } else {
              console.log("Skipping welcome email - Loops transactional ID not configured");
            }
          } catch (error) {
            console.error("Error sending Loops email:", error);
            // Don't show error to user - this is a background operation
          }
        }
      }

      toast.success("Calendar ready! Your calendar app should open automatically. Just tap 'Add' or 'Save' to sync the events.");
      onStarterPlanSelect();
      onClose();
      
      // Show feedback dialog after first download if user hasn't given feedback
      if (isFirstDownload && !hasGivenFeedback) {
        setTimeout(() => {
          setShowFeedbackDialog(true);
        }, 1000);
      }
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

  const PlanFeature = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-start gap-2 py-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {children}
      </p>
    </div>
  );

  const handleFeedbackClose = () => {
    setShowFeedbackDialog(false);
    localStorage.setItem('hasGivenFeedback', 'true');
  };

  return (
    <>
      <EmailPromptDialog
        open={showEmailPrompt}
        onEmailSubmit={handleEmailSubmit}
        onClose={() => setShowEmailPrompt(false)}
      />
      
      <FeedbackDialog
        open={showFeedbackDialog}
        onClose={handleFeedbackClose}
      />
      
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto p-4 sm:p-6 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="space-y-3 flex-shrink-0">
            <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <img src="/icon-option-6-blue.png" alt="App Icon" className="w-full h-full rounded-xl" />
            </div>
            <DialogTitle className="text-center text-sm sm:text-base font-semibold leading-relaxed px-1">
              You're almost there! Never miss your important dates again.
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-3 min-h-0">
            {/* Starter Plan */}
            <div className="rounded-lg border border-border/50 bg-accent/5 p-3 sm:p-4">
              <h3 className="text-center font-bold text-sm sm:text-base text-foreground mb-3">
                Starter Plan – Free
              </h3>
              <div className="space-y-0.5">
                <PlanFeature>
                  <strong>One</strong> school selection in your feed
                </PlanFeature>
                <PlanFeature>
                  Sync your already selected events now - just tap Connect Calendar
                </PlanFeature>
                <PlanFeature>
                  Get notified of changes or new events
                </PlanFeature>
                <PlanFeature>
                  Free in-app personal calendar <span className="text-muted-foreground/70">*Coming soon</span>
                </PlanFeature>
              </div>
              <Button 
                onClick={handleStarterPlan} 
                className="w-full text-xs sm:text-sm py-2 h-auto font-medium mt-3"
              >
                Starter Plan - Connect 1 calendar
              </Button>
            </div>

            {/* Graduate Plan */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
              <h3 className="text-center font-bold text-sm sm:text-base text-foreground mb-3">
                Graduate Plan – $25/year
              </h3>
              <div className="space-y-0.5">
                <PlanFeature>
                  <strong>Unlimited</strong> school selections in your feed
                </PlanFeature>
                <PlanFeature>
                  Add <strong>athletic team schedules</strong> for your schools
                </PlanFeature>
                <PlanFeature>
                  <strong>Share</strong> saved events with family and friends
                </PlanFeature>
                <PlanFeature>
                  Get notified of changes or new events
                </PlanFeature>
                <PlanFeature>
                  Free in-app personal calendar <span className="text-muted-foreground/70">*Coming soon</span>
                </PlanFeature>
              </div>
              <Button 
                onClick={handleStepUp}
                className="w-full text-xs sm:text-sm py-2 h-auto font-medium mt-3"
              >
                Graduate Plan - Connect Unlimited calendars
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-col items-center gap-2 pt-3 flex-shrink-0 border-t border-border/30 sm:flex-col">
            <p className="text-[10px] sm:text-xs text-muted-foreground text-center w-full">
              All data stays private and secure
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OnboardingDialog;
