import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => void;
}

const OnboardingDialog = ({
  open,
  onClose,
  onConnect
}: OnboardingDialogProps) => {
  const handleConnect = () => {
    // Simulate iOS calendar connection
    // In a real app, this would trigger iOS calendar API
    toast.success("Calendar connected successfully!");
    onConnect();
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-4 sm:mx-0">
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg sm:text-xl">Connect Your Calendar</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base px-2">
            Connect your iPhone calendar to automatically add important dates and never miss events!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 sm:space-y-3 py-3 sm:py-4">
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              Sync your selected event dates to your calendar instantly!
            </p>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              App badge notifications immediately inform you of updates to your feed events!
            </p>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              Sharing capability to send important dates to family and friends!
            </p>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              All data stays private and secure!
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={handleConnect} className="w-full text-sm sm:text-base">
            Connect iOS Calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDialog;
