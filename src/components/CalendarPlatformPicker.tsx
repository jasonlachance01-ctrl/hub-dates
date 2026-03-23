import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EventType } from "@/types";
import {
  generateICalendarFile,
  downloadICalendarFile,
  generateGoogleCalendarUrls,
  generateOutlookCalendarUrls,
} from "@/lib/calendarUtils";

interface CalendarPlatformPickerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedEvents: { orgName: string; events: EventType[] }[];
}

type Platform = "apple" | "google" | "outlook" | null;

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|Macintosh/i.test(ua) && "ontouchend" in document) return "apple";
  if (/Macintosh/i.test(ua)) return "apple";
  if (/Android|CrOS/i.test(ua)) return "google";
  if (/Windows/i.test(ua)) return "outlook";
  return null;
};

const CalendarPlatformPicker = ({
  open,
  onClose,
  onSuccess,
  selectedEvents,
}: CalendarPlatformPickerProps) => {
  const [suggested, setSuggested] = useState<Platform>(null);

  useEffect(() => {
    if (open) setSuggested(detectPlatform());
  }, [open]);

  const totalEvents = selectedEvents.reduce((sum, g) => sum + g.events.length, 0);

  const flatEvents: EventType[] = [];
  const orgNames: string[] = [];
  selectedEvents.forEach(({ orgName, events }) => {
    orgNames.push(orgName);
    events.forEach((ev) =>
      flatEvents.push({ ...ev, name: `${orgName} - ${ev.name}` })
    );
  });
  const combinedName =
    orgNames.length === 1
      ? orgNames[0]
      : `Academic-Calendar-${orgNames.length}-Schools`;

  const handleApple = () => {
    const ics = generateICalendarFile("", flatEvents);
    downloadICalendarFile(combinedName, ics);
    toast.success(
      `Calendar file downloaded with ${totalEvents} event${totalEvents !== 1 ? "s" : ""}! Your calendar app should open automatically.`
    );
    finish();
  };

  const handleGoogle = () => {
    if (totalEvents <= 3) {
      const urls = generateGoogleCalendarUrls(selectedEvents);
      urls.forEach((url, i) => {
        setTimeout(() => window.open(url, "_blank"), i * 400);
      });
      toast.success(`Opening ${totalEvents} event${totalEvents !== 1 ? "s" : ""} in Google Calendar!`);
    } else {
      const ics = generateICalendarFile("", flatEvents);
      downloadICalendarFile(combinedName, ics);
      setTimeout(() => {
        window.open(
          "https://calendar.google.com/calendar/u/0/r/settings/export",
          "_blank"
        );
      }, 600);
      toast.success(
        "Calendar file downloaded! On the Google Calendar page that just opened, click \"Select file from your computer\" to import it.",
        { duration: 8000 }
      );
    }
    finish();
  };

  const handleOutlook = () => {
    if (totalEvents <= 3) {
      const urls = generateOutlookCalendarUrls(selectedEvents);
      urls.forEach((url, i) => {
        setTimeout(() => window.open(url, "_blank"), i * 400);
      });
      toast.success(`Opening ${totalEvents} event${totalEvents !== 1 ? "s" : ""} in Outlook!`);
    } else {
      const ics = generateICalendarFile("", flatEvents);
      downloadICalendarFile(combinedName, ics);
      setTimeout(() => {
        window.open(
          "https://outlook.live.com/calendar/0/import",
          "_blank"
        );
      }, 600);
      toast.success(
        "Calendar file downloaded! On the Outlook page that just opened, browse for the downloaded file to import it.",
        { duration: 8000 }
      );
    }
    finish();
  };

  const finish = () => {
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Add to Your Calendar
          </DialogTitle>
          <DialogDescription className="text-center">
            {totalEvents} event{totalEvents !== 1 ? "s" : ""} ready — choose
            your calendar:
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button
            variant="outline"
            className="w-full h-14 text-base justify-start gap-3 relative"
            onClick={handleApple}
          >
            <span className="text-2xl">🍎</span>
            Apple Calendar
            {suggested === "apple" && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 text-base justify-start gap-3 relative"
            onClick={handleGoogle}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google Calendar
            {suggested === "google" && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 text-base justify-start gap-3 relative"
            onClick={handleOutlook}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576a.806.806 0 0 1-.588.234h-8.478v-8.07l2.348 1.696.478.26a.513.513 0 0 0 .478 0l.478-.26L24 7.387zM14.696 10.174V19.5H1.826c-.23 0-.424-.078-.582-.234A.782.782 0 0 1 1 18.69V5.31c0-.23.082-.424.244-.582A.782.782 0 0 1 1.826 4.5h6.87v5.674h6z" />
              <path fill="#0078D4" d="M14.696 4.5v5.674h9.304V7.387c0-.16-.043-.3-.13-.417a.748.748 0 0 0-.348-.287l-8.826-2.183z" />
            </svg>
            Outlook
            {suggested === "outlook" && (
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by AcademicAnnual.com
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarPlatformPicker;
