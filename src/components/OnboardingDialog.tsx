import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateICalendarFile, downloadICalendarFile } from "@/lib/calendarUtils";
import { Organization, EventType } from "@/types";
import EmailPromptDialog from "./EmailPromptDialog";
import FeedbackDialog from "./FeedbackDialog";

// Admin mode helper for testing - checks localStorage flag
const isAdminMode = () => localStorage.getItem('adminMode') === 'true';

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  onStarterPlanSelect: () => void;
  organizations: Organization[];
}

const OnboardingDialog = ({
  open,
  onClose,
  onStarterPlanSelect,
  organizations
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

  // Auto-trigger the download flow when dialog opens
  useEffect(() => {
    if (open && organizations.length > 0) {
      handleStarterPlan();
    }
  }, [open, organizations]);

  // Get all selected events from all organizations
  const getAllSelectedEvents = (): { orgName: string; events: EventType[] }[] => {
    return organizations
      .map(org => ({
        orgName: org.name,
        events: org.events.filter(e => e.addedToCalendar)
      }))
      .filter(item => item.events.length > 0);
  };

  const handleStarterPlan = () => {
    const selectedByOrg = getAllSelectedEvents();
    const totalSelectedEvents = selectedByOrg.reduce((sum, item) => sum + item.events.length, 0);

    if (totalSelectedEvents === 0) {
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
    const selectedByOrg = getAllSelectedEvents();
    const totalSelectedEvents = selectedByOrg.reduce((sum, item) => sum + item.events.length, 0);
    
    if (totalSelectedEvents === 0) return;

    const syncedOrgs = JSON.parse(localStorage.getItem('syncedOrganizations') || '[]');
    const isFirstDownload = syncedOrgs.length === 0;
    const hasGivenFeedback = localStorage.getItem('hasGivenFeedback') === 'true';

    // Generate and download .ics file with events from ALL organizations
    try {
      // Combine all selected events with org name prefix
      const allEvents: EventType[] = [];
      const orgNames: string[] = [];
      
      selectedByOrg.forEach(({ orgName, events }) => {
        orgNames.push(orgName);
        events.forEach(event => {
          allEvents.push({
            ...event,
            // Prefix event name with organization name
            name: `${orgName} - ${event.name}`
          });
        });
      });

      // Use combined name for filename
      const combinedName = orgNames.length === 1 
        ? orgNames[0] 
        : `Academic-Calendar-${orgNames.length}-Schools`;
      
      // Generate ICS with empty org name since we already prefixed event names
      const icsContent = generateICalendarFile("", allEvents);
      downloadICalendarFile(combinedName, icsContent);
      
      // Track all organizations as synced
      organizations.forEach(org => {
        if (!syncedOrgs.includes(org.id) && org.events.some(e => e.addedToCalendar)) {
          syncedOrgs.push(org.id);
        }
      });
      localStorage.setItem('syncedOrganizations', JSON.stringify(syncedOrgs));

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
                  organizationName: orgNames.join(", "),
                  eventCount: totalSelectedEvents
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

      toast.success(`Calendar ready with ${totalSelectedEvents} events from ${orgNames.length} school${orgNames.length > 1 ? 's' : ''}! Your calendar app should open automatically.`);
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
