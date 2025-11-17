import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EventSelectionDialog from "./EventSelectionDialog";
import { Organization, EventType } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface SearchBarProps {
  onAdd: (organization: Organization) => void;
  onSearchPerformed?: () => void;
}

interface SearchSuggestion {
  title: string;
  link: string;
  snippet: string;
}

const SearchBar = ({ onAdd, onSearchPerformed }: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingOrgName, setPendingOrgName] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("search-suggestions", {
          body: { query: searchQuery },
        });

        if (error) throw error;

        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a school or organization name");
      return;
    }

    // Extract organization name from URL or use as-is
    let orgName = searchQuery.trim();
    if (searchQuery.includes(".")) {
      // Simple URL parsing
      const urlParts = searchQuery.replace(/https?:\/\//, "").split(".");
      orgName = urlParts[0].charAt(0).toUpperCase() + urlParts[0].slice(1);
    }

    setPendingOrgName(orgName);
    setShowEventDialog(true);
  };

  const cleanOrganizationName = (name: string, url?: string): string => {
    // Extract actual school name from various result types
    let cleanName = name;
    
    // Remove common prefixes and suffixes from search results
    cleanName = cleanName
      .replace(/^Best\s+/i, '') // "Best Catholic Boys High School..."
      .replace(/:\s*Home$/i, '')
      .replace(/\s*-\s*Home$/i, '')
      .replace(/\s*\|\s*.*$/i, '') // "School | Additional Info"
      .replace(/\s*-\s*Official.*$/i, '')
      .replace(/\s*-\s*Wikipedia$/i, '')
      .replace(/\s*-\s*Niche$/i, '')
      .replace(/\s+in\s+[A-Z][a-z]+,?\s+[A-Z]{2}.*$/i, '') // "School in City, ST - Additional"
      .replace(/\s+\([^)]+\)$/i, '') // "(Location)" at end
      .trim();
    
    // If it's from a rating/review site, try to extract school name from URL
    if (url && (url.includes('niche.com') || url.includes('greatschools.org') || 
                url.includes('usnews.com') || url.includes('schooldigger.com'))) {
      // Try to extract from URL path
      const urlMatch = url.match(/\/([^/]+)(?:-\d+)?(?:\.html)?$/i);
      if (urlMatch) {
        const urlName = urlMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .replace(/\s+(High|Middle|Elementary)\s+School$/i, ' $1 School');
        if (urlName.length > 5) {
          cleanName = urlName;
        }
      }
    }
    
    // Ensure "High School" or similar is included
    if (!/\b(high|middle|elementary|academy|college|university)\s+school/i.test(cleanName) && 
        /\b(high|middle|elementary)\b/i.test(name)) {
      const match = name.match(/\b(high|middle|elementary)\s+school/i);
      if (match && !cleanName.includes(match[0])) {
        cleanName += ' ' + match[0];
      }
    }
    
    return cleanName.trim();
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    const cleanName = cleanOrganizationName(suggestion.title, suggestion.link);
    setSearchQuery(cleanName); // Use cleaned name in search bar too
    setShowSuggestions(false);
    handleSearchWithName(cleanName, suggestion.link);
  };

  const handleSearchWithName = (name: string, url?: string) => {
    setPendingOrgName(name);
    setShowEventDialog(true);
  };

  const handleEventSelection = async (selectedEvents: EventType[]) => {
    setShowEventDialog(false);
    
    // Show loading toast
    const loadingToast = toast.loading(`Fetching dates for ${pendingOrgName}...`);

    try {
      // Fetch dates for the selected events
      const { data, error } = await supabase.functions.invoke("fetch-event-dates", {
        body: {
          organizationName: pendingOrgName,
          events: selectedEvents.map(e => ({ id: e.id, name: e.name }))
        },
      });

      if (error) throw error;

      // Merge the dates with the selected events
      const eventsWithDates = selectedEvents.map(event => {
        const eventDate = data.eventDates?.find((ed: any) => ed.eventName === event.name);
        return {
          ...event,
          date: eventDate?.date || undefined
        };
      });

      const newOrg: Organization = {
        id: Date.now().toString(),
        name: pendingOrgName,
        url: searchQuery.includes(".") ? searchQuery : undefined,
        events: eventsWithDates,
      };

      onAdd(newOrg);
      setSearchQuery("");
      setSuggestions([]);
      
      // Increment user count
      onSearchPerformed?.();
      
      toast.dismiss(loadingToast);
      toast.success(`${pendingOrgName} added to your feed`);
    } catch (error) {
      console.error("Error fetching event dates:", error);
      toast.dismiss(loadingToast);
      
      // Add without dates as fallback
      const newOrg: Organization = {
        id: Date.now().toString(),
        name: pendingOrgName,
        url: searchQuery.includes(".") ? searchQuery : undefined,
        events: selectedEvents,
      };

      onAdd(newOrg);
      setSearchQuery("");
      setSuggestions([]);
      
      // Increment user count
      onSearchPerformed?.();
      toast.warning(`${pendingOrgName} added, but couldn't fetch all dates`);
    }
  };

  return (
    <>
      <p className="text-sm text-muted-foreground mb-0.5 text-center">
        Include City Name for accurate results.
      </p>
      <div ref={searchRef} className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search schools or enter URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-11"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute top-full mt-2 w-full z-50 max-h-96 overflow-y-auto">
              {suggestions.map((suggestion, index) => {
                const isOfficialSite = suggestion.link.includes('.edu') || 
                                       suggestion.link.match(/\b(school|academy|college|university)\b/i);
                return (
                  <button
                    key={index}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="w-full text-left p-3 hover:bg-accent transition-colors border-b last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{suggestion.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {suggestion.snippet}
                        </div>
                      </div>
                      {isOfficialSite && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                          Official
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </Card>
          )}
          
          {isLoading && (
            <div className="absolute top-full mt-2 w-full z-50">
              <Card className="p-3 text-center text-sm text-muted-foreground">
                Loading suggestions...
              </Card>
            </div>
          )}
        </div>
        <Button onClick={handleSearch} size="lg" className="px-6">
          Add
        </Button>
      </div>

      <EventSelectionDialog
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        organizationName={pendingOrgName}
        onConfirm={handleEventSelection}
      />
    </>
  );
};

export default SearchBar;
