import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EventType, DEFAULT_EVENT_TYPES } from "@/types";
import { toast } from "sonner";

interface EventSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  organizationName: string;
  onConfirm: (selectedEvents: EventType[]) => void;
}

const EventSelectionDialog = ({
  open,
  onClose,
  organizationName,
  onConfirm,
}: EventSelectionDialogProps) => {
  const [events, setEvents] = useState<EventType[]>([]);

  useEffect(() => {
    if (open) {
      // Reset events when dialog opens
      setEvents(
        DEFAULT_EVENT_TYPES.map((event) => ({
          ...event,
          selected: false,
          addedToCalendar: false,
        }))
      );
    }
  }, [open]);

  const handleToggle = (eventId: string) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, selected: !event.selected } : event
      )
    );
  };

  const handleConfirm = () => {
    const selectedEvents = events.filter((e) => e.selected);
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    // Simulate fetching dates (in real app, this would query Google/ChatGPT)
    const eventsWithDates = selectedEvents.map((event) => ({
      ...event,
      date: getMockDate(event.id),
    }));

    onConfirm(eventsWithDates);
  };

  // Mock date generator for demo purposes
  const getMockDate = (eventId: string): string => {
    const dates: Record<string, string> = {
      "first-day": "Aug 17",
      "fall-break": "Oct 14-16",
      "thanksgiving": "Nov 23-27",
      "winter-break": "Dec 18 - Jan 8",
      "spring-break": "Mar 11-15",
      "graduation": "May 12",
      "last-day": "May 8",
    };
    return dates[eventId] || "TBD";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{organizationName}</DialogTitle>
          <DialogDescription>
            Select the events you want to track for this organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <label
                htmlFor={event.id}
                className="text-sm font-medium cursor-pointer flex-1"
              >
                {event.name}
              </label>
              <Switch
                id={event.id}
                checked={event.selected}
                onCheckedChange={() => handleToggle(event.id)}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            Save to Feed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventSelectionDialog;
