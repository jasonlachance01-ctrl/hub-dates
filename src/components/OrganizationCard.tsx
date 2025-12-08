import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Trash2 } from "lucide-react";
import { Organization } from "@/types";
import { toast } from "sonner";
import { useEventMonitoring } from "@/hooks/useEventMonitoring";
import { normalizeDateDisplay } from "@/lib/dateUtils";
import { generateICalendarFile, downloadICalendarFile } from "@/lib/calendarUtils";
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
  onAddToCalendar: (orgId: string, onSuccess: () => void) => void;
}

const OrganizationCard = ({
  organization,
  onRemove,
  onUpdate,
  onAddToCalendar,
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

  const handleAddEvent = (eventId: string) => {
    const event = organization.events.find(e => e.id === eventId);
    // Don't allow toggling already synced events
    if (event?.syncedToCalendar) return;
    
    const updatedEvents = organization.events.map(event =>
      event.id === eventId
        ? { ...event, addedToCalendar: !event.addedToCalendar }
        : event
    );
    onUpdate({
      ...organization,
      events: updatedEvents,
    });
  };

  const handleAddToCalendar = () => {
    const selectedEvents = organization.events.filter((e) => e.addedToCalendar && e.date);

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event with a date");
      return;
    }

    setIsSyncing(true);
    
    // Call parent - events keep addedToCalendar: true so they're included in multi-school downloads
    onAddToCalendar(organization.id, () => {
      // Mark selected events as synced but KEEP addedToCalendar: true for multi-school download support
      const updatedEvents = organization.events.map(event =>
        event.addedToCalendar
          ? { ...event, syncedToCalendar: true }
          : event
      );
      onUpdate({
        ...organization,
        events: updatedEvents,
      });
      setIsSyncing(false);
    });
  };

  const hasSelectedEvents = organization.events.some((e) => e.addedToCalendar && e.date);
  const hasNewSelectionsToSync = organization.events.some((e) => e.addedToCalendar && !e.syncedToCalendar && e.date);

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
                <p className="text-xs sm:text-sm font-medium line-clamp-2">{event.name}</p>
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
                  {event.syncedToCalendar && (
                    <span className="text-[10px] text-muted-foreground/60">Added</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAddEvent(event.id)}
                disabled={event.syncedToCalendar}
                className={`h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 transition-colors ${
                  event.addedToCalendar || event.syncedToCalendar
                    ? "bg-success hover:bg-success/90 text-success-foreground"
                    : "hover:bg-accent"
                } ${event.syncedToCalendar ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {event.addedToCalendar || event.syncedToCalendar ? (
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
            {isSyncing 
              ? "Downloading..." 
              : hasNewSelectionsToSync
                ? "Sync to Calendar"
                : hasSelectedEvents
                  ? "Re-sync to Calendar"
                  : "Sync to Calendar"}
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
