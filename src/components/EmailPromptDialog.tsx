import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Lock } from "lucide-react";

interface EmailPromptDialogProps {
  open: boolean;
  onEmailSubmit: (email: string) => void;
  onClose: () => void;
}

const emailSchema = z.string().email("Please enter a valid email address");

const GLASS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

const EmailPromptDialog = ({ open, onEmailSubmit, onClose }: EmailPromptDialogProps) => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = emailSchema.safeParse(email.trim());
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("user_emails")
        .insert([{ email: email.trim() }]);

      if (error) {
        if (error.code !== "23505") throw error;
      }

      localStorage.setItem("userEmail", email.trim());

      try {
        await supabase.functions.invoke("add-loops-contact", {
          body: { email: email.trim(), source: "calendar_sync" },
        });
      } catch (loopsError) {
        console.error("Error adding to Loops:", loopsError);
      }

      onEmailSubmit(email.trim());
    } catch (error) {
      console.error("Error saving email:", error);
      toast.error("Failed to save email. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        {/* Overlay: lighter tint + subtle blur */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Glass panel */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-[85vw] max-w-[380px] -translate-x-1/2 -translate-y-1/2 border border-white/40 bg-white/[0.78] shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          style={{
            fontFamily: GLASS_FONT,
            borderRadius: 22,
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          }}
        >
          {/* Handle bar (iOS sheet indicator) */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-[5px] w-9 rounded-full bg-gray-400/50" />
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6">
            {/* Header */}
            <div className="space-y-1 text-center mb-5">
              <DialogPrimitive.Title className="text-[20px] font-semibold tracking-tight text-gray-900">
                Enter your email
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[15px] text-gray-500">
                To complete sync approval
              </DialogPrimitive.Description>
            </div>

            {/* Input + Button */}
            <div className="space-y-3">
              <input
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-[50px] w-full rounded-[14px] bg-[#F2F2F7]/80 px-4 text-[17px] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:bg-[#F2F2F7] focus:ring-[3px] focus:ring-[#007AFF]/20"
                style={{ fontFamily: GLASS_FONT }}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-[50px] w-full rounded-[14px] bg-[#007AFF] text-[17px] font-semibold text-white transition-all hover:bg-[#0066DD] active:scale-[0.97] disabled:opacity-50"
                style={{ fontFamily: GLASS_FONT }}
              >
                {isSubmitting ? "Confirming…" : "Confirm"}
              </button>

              <p className="flex items-center justify-center gap-1 text-[12px] text-gray-400">
                <Lock className="h-3 w-3" />
                All data stays private and secure
              </p>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default EmailPromptDialog;
