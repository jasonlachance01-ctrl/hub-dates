import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="w-[90vw] max-w-sm mx-auto sm:w-full">
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
            <img src="/icon-option-6-blue.png" alt="App Icon" className="w-full h-full rounded-2xl" />
          </div>
          <DialogTitle className="text-center text-lg sm:text-xl leading-tight">You are almost to the most effortless and rewarding calendar management you have ever experienced! You will never miss your important dates.</DialogTitle>
        </DialogHeader>

        <div className="text-center font-semibold text-sm sm:text-base text-foreground pt-2 pb-1">
          Free Plan Includes feeds from up to two schools or organizations.
        </div>

        <div className="space-y-2 sm:space-y-3 pb-3 sm:pb-4">
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              Syncs your already selected event dates to your calendar instantly via one time Google authorization. Approve once and you will not have to again.
            </p>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              Receive app notifications informing you of changes or new events to your feed selections.
            </p>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              Share your saved event dates with family and friends!
            </p>
          </div>
          <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-accent/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-muted-foreground flex-1">
              Receive free version of Calsync in-app calendar! *Not available in Beta.
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
            Connect Calendar with one-time Google Authorization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDialog;
