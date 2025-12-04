import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const FeedbackDialog = ({ open, onClose }: FeedbackDialogProps) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const userEmail = localStorage.getItem('userEmail');
      
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_email: userEmail,
          rating,
          feedback: feedback.trim() || null
        });

      if (error) throw error;

      toast.success("Submission received, Thank You!");
      onClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const wordCount = feedback.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto p-6">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-center text-lg font-semibold leading-relaxed">
            Thank you for using Academic Annual. We would love your feedback!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-muted text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                You rated {rating} star{rating !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Feedback Text Area */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Share your Feedback</h3>
            <Textarea
              value={feedback}
              onChange={(e) => {
                const words = e.target.value.trim().split(/\s+/).filter(word => word.length > 0);
                if (words.length <= 100) {
                  setFeedback(e.target.value);
                }
              }}
              placeholder="Tell us what you think... (optional)"
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {wordCount}/100 words
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="w-full"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
