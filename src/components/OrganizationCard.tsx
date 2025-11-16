import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Check, Trash2 } from "lucide-react";
import { Organization } from "@/types";
import { toast } from "sonner";
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

  const handleAddToCalendar = () => {
    // Trigger onboarding dialog if calendar not connected
    if (!calendarConnected) {
      onAddToCalendarClick();
      return;
    }

    const selectedEvents = organization.events.filter((e) => e.addedToCalendar);

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    // Simulate adding to calendar
    toast.success(`${selectedEvents.length} event(s) added to your calendar`);
  };

  const hasSelectedEvents = organization.events.some((e) => e.addedToCalendar);

  return (
    <>
      <Card className="h-full flex flex-col shadow-lg border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-xl font-bold">{organization.name}</CardTitle>
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
            <p className="text-xs text-muted-foreground">{organization.url}</p>
          )}
        </CardHeader>

        <CardContent className="flex-1 space-y-2 overflow-y-auto">
          {organization.events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-medium truncate">{event.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.date || "Date not available - will monitor and notify when announced"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleEvent(event.id)}
                className={`h-8 w-8 flex-shrink-0 transition-colors ${
                  event.addedToCalendar
                    ? "bg-success hover:bg-success/90 text-success-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {event.addedToCalendar ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </CardContent>

        <CardFooter className="pt-3">
          <Button
            onClick={handleAddToCalendar}
            className="w-full"
            disabled={!hasSelectedEvents}
          >
            Add to Calendar
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this calendar from your feed. You can always add it back
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default OrganizationCard;
