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
import { Badge } from "@/components/ui/badge";
import { EventType, DEFAULT_EVENT_TYPES } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";

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
  const [athleticsSchedule, setAthleticsSchedule] = useState<string[]>([]);

  const ATHLETICS_OPTIONS = [
    "Football",
    "Men's Soccer",
    "Women's Soccer",
    "Men's Basketball",
    "Women's Basketball",
  ];

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
      setAthleticsSchedule([]);
    }
  }, [open]);

  const handleAddAthleticsSchedule = (value: string) => {
    if (!athleticsSchedule.includes(value)) {
      setAthleticsSchedule([...athleticsSchedule, value]);
    }
  };

  const handleRemoveAthleticsSchedule = (value: string) => {
    setAthleticsSchedule(athleticsSchedule.filter(s => s !== value));
  };

  const handleClearAllAthletics = () => {
    setAthleticsSchedule([]);
  };

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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Athletics Schedule</label>
                {athleticsSchedule.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAllAthletics}
                    className="h-auto py-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              <Select onValueChange={handleAddAthleticsSchedule}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sports" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {ATHLETICS_OPTIONS.map((option) => (
                    <SelectItem 
                      key={option} 
                      value={option}
                      disabled={athleticsSchedule.includes(option)}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {athleticsSchedule.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {athleticsSchedule.map((sport) => (
                    <Badge
                      key={sport}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {sport}
                      <button
                        onClick={() => handleRemoveAthleticsSchedule(sport)}
                        className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
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
