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
  const handleSkip = () => {
    toast.info("You can connect your calendar later from settings");
    onClose();
  };
  return <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Connect Your Calendar</DialogTitle>
          <DialogDescription className="text-center">
            Connect your iOS calendar to automatically add important dates and never miss
            an event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground flex-1">
              Sync your selected event dates to your calendar instantly!
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground flex-1">App badge notifications immediately inform you of updates to your feed events!                                                                                                              </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            <p className="text-sm text-muted-foreground flex-1">
              All data stays private and secure
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={handleConnect} className="w-full">
            Connect iOS Calendar
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="w-full">
            Skip for now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
};
export default OnboardingDialog;