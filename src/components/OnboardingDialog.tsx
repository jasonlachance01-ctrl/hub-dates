import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Organization, EventType } from "@/types";
import EmailPromptDialog from "./EmailPromptDialog";
import FeedbackDialog from "./FeedbackDialog";
import CalendarPlatformPicker from "./CalendarPlatformPicker";

const isAdminMode = () => localStorage.getItem("adminMode") === "true";

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
  onStarterPlanSelect: () => void;
  organizations: Organization[];
}

const OnboardingDialog = ({ open, onClose, onStarterPlanSelect, organizations }: OnboardingDialogProps) => {
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") {
      localStorage.setItem("adminMode", "true");
      toast.success("Admin mode enabled - unlimited downloads for testing");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (open && organizations.length > 0) {
      handleStarterPlan();
    }
  }, [open, organizations]);

  const getAllSelectedEvents = (orgs: Organization[]): { orgName: string; events: EventType[] }[] => {
    return orgs
      .map((org) => ({
        orgName: org.name,
        events: org.events.filter((e) => e.addedToCalendar && e.date),
      }))
      .filter((item) => item.events.length > 0);
  };

  const handleStarterPlan = () => {
    const selectedByOrg = getAllSelectedEvents(organizations);
    const totalSelectedEvents = selectedByOrg.reduce((sum, item) => sum + item.events.length, 0);

    if (totalSelectedEvents === 0) {
      toast.error("Please select at least one event to sync");
      return;
    }

    if (isAdminMode()) {
      setShowPlatformPicker(true);
      return;
    }

    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      setShowEmailPrompt(true);
      return;
    }

    setShowPlatformPicker(true);
  };

  const handlePlatformSuccess = async () => {
    const selectedByOrg = getAllSelectedEvents(organizations);
    const totalSelectedEvents = selectedByOrg.reduce((sum, item) => sum + item.events.length, 0);
    const orgNames = selectedByOrg.map((g) => g.orgName);

    const syncedOrgs = JSON.parse(localStorage.getItem("syncedOrganizations") || "[]");
    const isFirstDownload = !localStorage.getItem("hasDownloaded");
    const hasGivenFeedback = localStorage.getItem("hasGivenFeedback") === "true";

    localStorage.setItem("hasDownloaded", "true");

    organizations.forEach((org) => {
      if (!syncedOrgs.includes(org.id) && org.events.some((e) => e.addedToCalendar)) {
        syncedOrgs.push(org.id);
      }
    });
    localStorage.setItem("syncedOrganizations", JSON.stringify(syncedOrgs));

    if (isFirstDownload) {
      const userEmail = localStorage.getItem("userEmail");
      if (userEmail) {
        try {
          await supabase.functions.invoke("send-loops-event", {
            body: {
              email: userEmail,
              eventName: "first_download",
              eventProperties: {
                organizationName: orgNames.join(", "),
                eventCount: totalSelectedEvents,
              },
            },
          });
        } catch (error) {
          console.error("Error sending Loops event:", error);
        }
      }
    }

    onStarterPlanSelect();
    onClose();

    if (isFirstDownload && !hasGivenFeedback) {
      setTimeout(() => {
        setShowFeedbackDialog(true);
      }, 1000);
    }
  };

  const handleEmailSubmit = () => {
    setShowEmailPrompt(false);
    setShowPlatformPicker(true);
  };

  const handleFeedbackClose = () => {
    setShowFeedbackDialog(false);
    localStorage.setItem("hasGivenFeedback", "true");
  };

  return (
    <>
      <EmailPromptDialog
        open={showEmailPrompt}
        onEmailSubmit={handleEmailSubmit}
        onClose={() => setShowEmailPrompt(false)}
      />

      <CalendarPlatformPicker
        open={showPlatformPicker}
        onClose={() => {
          setShowPlatformPicker(false);
          onClose();
        }}
        onSuccess={handlePlatformSuccess}
        selectedEvents={getAllSelectedEvents(organizations)}
      />

      <FeedbackDialog open={showFeedbackDialog} onClose={handleFeedbackClose} />
    </>
  );
};

export default OnboardingDialog;
