import { useState, useRef, useEffect } from "react";
import OrganizationCard from "./OrganizationCard";
import { Organization } from "@/types";

interface OrganizationCarouselProps {
  organizations: Organization[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updated: Organization) => void;
  onAddToCalendar: (orgId: string, onSuccess: () => void) => void;
}

const OrganizationCarousel = ({
  organizations,
  onRemove,
  onUpdate,
  onAddToCalendar,
}: OrganizationCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const prevLengthRef = useRef(organizations.length);

  useEffect(() => {
    // Reset to first card when a new organization is added
    if (organizations.length > prevLengthRef.current) {
      setCurrentIndex(0);
    }
    // Reset to last valid card if cards are removed
    else if (organizations.length > 0 && currentIndex >= organizations.length) {
      setCurrentIndex(organizations.length - 1);
    }
    prevLengthRef.current = organizations.length;
  }, [organizations.length, currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;

    const endX = e.changedTouches[0].clientX;
    const diff = startXRef.current - endX;

    // Swipe threshold
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < organizations.length - 1) {
        // Swipe left - next card
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous card
        setCurrentIndex(currentIndex - 1);
      }
    }

    startXRef.current = null;
  };

  // Calculate total selected events across all organizations
  const totalSelectedEvents = organizations.reduce((total, org) => {
    return total + org.events.filter(e => e.addedToCalendar).length;
  }, 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Carousel Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">Your Calendars</h2>
          {totalSelectedEvents > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              {totalSelectedEvents} event{totalSelectedEvents !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {organizations.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 w-6 rounded-full transition-all ${
                index === currentIndex ? "bg-primary" : "bg-border"
              }`}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Carousel Container */}
      <div
        ref={carouselRef}
        className="relative flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {organizations.map((org) => (
            <div key={org.id} className="w-full flex-shrink-0 px-1">
              <OrganizationCard
                organization={org}
                onRemove={() => onRemove(org.id)}
                onUpdate={(updated) => onUpdate(org.id, updated)}
                onAddToCalendar={(orgId, onSuccess) => onAddToCalendar(orgId, onSuccess)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Swipe Hint */}
      {organizations.length > 1 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          Swipe to see more calendars
        </p>
      )}
    </div>
  );
};

export default OrganizationCarousel;
