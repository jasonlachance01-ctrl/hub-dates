import { useState, useRef, useEffect } from "react";
import OrganizationCard from "./OrganizationCard";
import { Organization } from "@/types";

interface OrganizationCarouselProps {
  organizations: Organization[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, updated: Organization) => void;
}

const OrganizationCarousel = ({
  organizations,
  onRemove,
  onUpdate,
}: OrganizationCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset to first card if all cards are removed
    if (organizations.length > 0 && currentIndex >= organizations.length) {
      setCurrentIndex(organizations.length - 1);
    }
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

  return (
    <div className="flex-1 flex flex-col">
      {/* Carousel Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">Your Calendars</h2>
        <div className="flex items-center gap-2">
          {organizations.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex ? "w-8 bg-primary" : "w-1.5 bg-border"
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
