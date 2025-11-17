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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventType, DEFAULT_EVENT_TYPES } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(false);
  const [athleticsSchedule, setAthleticsSchedule] = useState<string>("");

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

  const handleConfirm = async () => {
    const selectedEvents = events.filter((e) => e.selected);
    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    setIsLoading(true);

    try {
      // Call the fetch-event-dates edge function
      const { data, error } = await supabase.functions.invoke('fetch-event-dates', {
        body: {
          organizationName,
          events: selectedEvents.map(e => e.name),
        },
      });

      if (error) throw error;

      const { eventDates } = data;

      // Map the results back to our event structure
      const eventsWithDates = selectedEvents.map((event) => {
        const foundDate = eventDates?.find((ed: any) => ed.event === event.name);
        return {
          ...event,
          date: foundDate?.date || null,
        };
      });

      // Save events without dates to monitoring table
      const eventsToMonitor = eventsWithDates.filter(e => !e.date);
      
      if (eventsToMonitor.length > 0) {
        const monitoringInserts = eventsToMonitor.map(event => ({
          organization_name: organizationName,
          event_name: event.name,
          date_found: null,
        }));

        const { error: monitorError } = await supabase
          .from('event_monitoring')
          .insert(monitoringInserts);

        if (monitorError) {
          console.error('Error adding events to monitoring:', monitorError);
        }
      }

      onConfirm(eventsWithDates);
      toast.success(`Added ${selectedEvents.length} events to your feed`);
    } catch (error) {
      console.error('Error fetching event dates:', error);
      toast.error('Failed to fetch event dates. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock date generator removed - now using real API

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{organizationName}</DialogTitle>
          <DialogDescription>
            Select the events you want to track for this organization. Only future dates will be shown.
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

          <div className="p-3 rounded-lg border bg-card">
            <label className="text-sm font-medium block mb-2">
              Athletics Schedule
            </label>
            <Select value={athleticsSchedule} onValueChange={setAthleticsSchedule}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="football">Football</SelectItem>
                <SelectItem value="mens-soccer">Men's Soccer</SelectItem>
                <SelectItem value="womens-soccer">Women's Soccer</SelectItem>
                <SelectItem value="mens-basketball">Men's Basketball</SelectItem>
                <SelectItem value="womens-basketball">Women's Basketball</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding dates...
              </>
            ) : (
              'Save to Feed'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventSelectionDialog;
