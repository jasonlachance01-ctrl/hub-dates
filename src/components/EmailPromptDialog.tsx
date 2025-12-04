import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface EmailPromptDialogProps {
  open: boolean;
  onEmailSubmit: (email: string) => void;
  onClose: () => void;
}

const emailSchema = z.string().email("Please enter a valid email address");

const EmailPromptDialog = ({ open, onEmailSubmit, onClose }: EmailPromptDialogProps) => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const validation = emailSchema.safeParse(email.trim());
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      // Store email in database
      const { error } = await supabase
        .from('user_emails')
        .insert([{ email: email.trim() }]);

      if (error) {
        // If email already exists, that's okay - we just want to track it
        if (error.code !== '23505') { // 23505 is unique violation error code
          throw error;
        }
      }

      // Store email in localStorage for future reference
      localStorage.setItem('userEmail', email.trim());
      
      // Add contact to Loops.so
      try {
        await supabase.functions.invoke('add-loops-contact', {
          body: {
            email: email.trim(),
            source: 'calendar_sync'
          }
        });
      } catch (loopsError) {
        console.error("Error adding to Loops:", loopsError);
        // Don't block the flow if Loops fails
      }
      
      onEmailSubmit(email.trim());
    } catch (error) {
      console.error("Error saving email:", error);
      toast.error("Failed to save email. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[85vw] max-w-[380px] mx-auto p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-center text-base sm:text-lg">
              Enter email address to complete sync approval.
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Confirming..." : "Confirm"}
            </Button>
            <p className="text-[10px] sm:text-xs text-foreground/70 text-center w-full">
              All data stays private and secure
            </p>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EmailPromptDialog;
