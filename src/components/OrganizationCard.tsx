import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Trash2 } from "lucide-react";
import { Organization } from "@/types";
import { toast } from "sonner";
import { useEventMonitoring } from "@/hooks/useEventMonitoring";
import { normalizeDateDisplay } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrganizationCardProps {
  organization: Organization;
  onRemove: () => void;
  onUpdate: (updated: Organization) => void;
  calendarConnected: boolean;
  onAddToCalendarClick: () => void;
}

const OrganizationCard = ({
  organization,
  onRemove,
  onUpdate,
  calendarConnected,
  onAddToCalendarClick,
}: OrganizationCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { newDates, hasNotifications } = useEventMonitoring(organization.name);

  // Calculate school year based on current date
  const getSchoolYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = January, 6 = July)
    
    // If July or later, show upcoming year combination
    if (currentMonth >= 6) {
      return `${currentYear}-${currentYear + 1}`;
    }
    // If before July, show current year combination
    return `${currentYear - 1}-${currentYear}`;
  };

  const handleToggleEvent = (eventId: string) => {
    const updatedEvents = organization.events.map((event) =>
      event.id === eventId
        ? { ...event, addedToCalendar: !event.addedToCalendar }
        : event
    );

    onUpdate({
      ...organization,
      events: updatedEvents,
    });
  };

  const handleAddToCalendar = async () => {
    const selectedEvents = organization.events.filter((e) => e.addedToCalendar);

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    // Check if calendar is already connected
    const accessToken = localStorage.getItem("googleCalendarAccessToken");
    
    if (!accessToken) {
      // Not connected, show onboarding dialog
      onAddToCalendarClick();
      return;
    }
    
    // Already connected, sync directly
    setIsSyncing(true);
    try {
      const eventsToSync = selectedEvents.map(e => ({
        name: e.name,
        date: e.date,
        organizationName: organization.name
      }));

      const { data, error } = await supabase.functions.invoke("sync-calendar-events", {
        body: { accessToken, events: eventsToSync }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const { successCount, totalCount } = data;
      
      if (successCount === totalCount) {
        toast.success(`Successfully synced ${successCount} event${successCount > 1 ? 's' : ''} to Google Calendar!`);
      } else {
        toast.warning(`Synced ${successCount} of ${totalCount} events. Some events may have failed.`);
      }
    } catch (error) {
      console.error("Error syncing to calendar:", error);
      toast.error("Failed to sync events. Please try reconnecting your calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const hasSelectedEvents = organization.events.some((e) => e.addedToCalendar);

  return (
    <>
      <Card className="h-full flex flex-col shadow-lg border-border/50 relative">
        {hasNotifications && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse z-10">
            {newDates.length}
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold">{organization.name}</CardTitle>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{getSchoolYear()}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {organization.url && (
            <p className="text-xs text-muted-foreground truncate">{organization.url}</p>
          )}
        </CardHeader>

        <CardContent className="flex-1 space-y-2 overflow-y-auto max-h-[50vh]">
          {organization.events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-2 sm:mr-3">
                <p className="text-xs sm:text-sm font-medium truncate">{event.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {event.date 
                      ? normalizeDateDisplay(event.date)
                      : "Date not available - will monitor and notify when announced"}
                  </p>
                  {!event.date && newDates.some(nd => nd.event_name === event.name) && (
                    <Badge variant="default" className="text-xs py-0 px-1.5 bg-primary text-primary-foreground">
                      New!
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleEvent(event.id)}
                className={`h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 transition-colors ${
                  event.addedToCalendar
                    ? "bg-success hover:bg-success/90 text-success-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {event.addedToCalendar ? (
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </Button>
            </div>
          ))}
        </CardContent>

        <CardFooter className="pt-3">
          <Button
            onClick={handleAddToCalendar}
            className="w-full text-sm"
            disabled={!hasSelectedEvents || isSyncing}
          >
            {isSyncing ? "Syncing..." : calendarConnected ? "Sync to Calendar" : "Add to Calendar"}
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Remove Organization?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to remove {organization.name} from your feed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove} className="w-full sm:w-auto text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrganizationCard;
