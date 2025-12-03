import { useState, useEffect } from "react";
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
  onStarterPlanSelect,
  pendingOrg
}: OnboardingDialogProps) => {
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

  // Auto-trigger the download flow when dialog opens (skip pricing dialog)
  useEffect(() => {
    if (open && pendingOrg) {
      handleStarterPlan();
    }
  }, [open, pendingOrg]);

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

    // In admin mode, bypass email check
    if (isAdminMode()) {
      proceedWithDownload();
      return;
    }

    // Check if user hasn't provided email yet
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
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
            console.log("Welcome email event sent to Loops");
          } catch (error) {
            console.error("Error sending Loops event:", error);
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

  const handleEmailSubmit = () => {
    setShowEmailPrompt(false);
    proceedWithDownload();
  };

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
    </>
  );
};

export default OnboardingDialog;
