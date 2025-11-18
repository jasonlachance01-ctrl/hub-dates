import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Organization, EventType } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { validateOrganizationInput } from "@/lib/validation";

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
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldFetchSuggestions, setShouldFetchSuggestions] = useState(true);
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

  const prioritizeSuggestions = (suggestions: SearchSuggestion[]): SearchSuggestion[] => {
    // Define priority scoring
    const getPriorityScore = (suggestion: SearchSuggestion): number => {
      const url = suggestion.link.toLowerCase();
      const title = suggestion.title.toLowerCase();
      
      // Highest priority: .edu domains (official educational institutions)
      if (url.includes('.edu')) return 1000;
      
      // High priority: Official school/academy/college websites
      if (url.match(/\.(school|academy|k12)\./)) return 900;
      if (title.includes('official') && url.match(/\.(com|org)/)) return 850;
      
      // Medium-high priority: School district sites
      if (url.includes('schooldistrict') || url.includes('district')) return 800;
      
      // Low priority: Rating and review sites
      if (url.includes('niche.com')) return 100;
      if (url.includes('greatschools.org')) return 90;
      if (url.includes('usnews.com')) return 80;
      if (url.includes('schooldigger.com')) return 70;
      
      // Lower priority: News articles and blogs
      if (url.includes('/news/') || url.includes('/article/')) return 50;
      if (url.includes('blog')) return 40;
      
      // Very low priority: Wikipedia
      if (url.includes('wikipedia.org')) return 30;
      
      // Default priority: Everything else
      return 500;
    };
    
    // Sort by priority score (highest first)
    return [...suggestions].sort((a, b) => {
      return getPriorityScore(b) - getPriorityScore(a);
    });
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2 || !shouldFetchSuggestions) {
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

        // Prioritize official school websites
        const prioritized = prioritizeSuggestions(data.suggestions || []);
        setSuggestions(prioritized);
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
  }, [searchQuery, shouldFetchSuggestions]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a school or organization name");
      return;
    }

    // Validate input
    const validation = validateOrganizationInput(searchQuery.trim());
    if (!validation.success) {
      toast.error(validation.error);
      return;
    }

    let organizationName = searchQuery.trim();

    // If there are suggestions, use the official name from the top result
    if (suggestions.length > 0) {
      const topSuggestion = suggestions[0];
      organizationName = cleanOrganizationName(topSuggestion.title, topSuggestion.link);
    } else {
      // Try to get suggestions first
      try {
        const { data, error } = await supabase.functions.invoke("search-suggestions", {
          body: { query: searchQuery },
        });

        if (!error && data.suggestions?.length > 0) {
          const prioritized = prioritizeSuggestions(data.suggestions);
          const topSuggestion = prioritized[0];
          organizationName = cleanOrganizationName(topSuggestion.title, topSuggestion.link);
        }
      } catch (error) {
        console.error("Error fetching official name:", error);
      }
    }

    // Directly fetch event dates
    const loadingToast = toast.loading(`Fetching dates for ${organizationName}...`);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-event-dates", {
        body: { organizationName }
      });

      if (error) throw error;

      const events = data.eventDates?.map((ed: any, index: number) => ({
        id: `${ed.eventName.toLowerCase().replace(/\s+/g, '-')}-${index}`,
        name: ed.eventName,
        date: ed.date,
        addedToCalendar: false
      })) || [];

      const newOrg: Organization = {
        id: Date.now().toString(),
        name: organizationName,
        url: searchQuery.includes(".") ? searchQuery : undefined,
        events,
      };

      onAdd(newOrg);
      setSearchQuery("");
      setSuggestions([]);
      setShouldFetchSuggestions(true); // Re-enable suggestions for next search
      onSearchPerformed?.();
      
      toast.dismiss(loadingToast);
      toast.success(`${organizationName} added with ${events.length} events`);
    } catch (error) {
      console.error("Error fetching event dates:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to fetch event dates. Please try again.");
    }
  };

  const cleanOrganizationName = (name: string, url?: string): string => {
    // Extract actual school name from various result types
    let cleanName = name;
    
    // Remove common prefixes and suffixes from search results
    cleanName = cleanName
      .replace(/^Best\s+/i, '') // "Best Catholic Boys High School..."
      .replace(/:\s*(?:Home|Homepage|Home\s+Page|Official\s+Site|Website).*$/i, '') // Remove ": Homepage", ": Home", etc.
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
    setShouldFetchSuggestions(false); // Stop fetching suggestions after selection
    const cleanName = cleanOrganizationName(suggestion.title, suggestion.link);
    setSearchQuery(cleanName);
    setShowSuggestions(false);
    setTimeout(() => handleSearch(), 100);
  };


  return (
    <>
      <div ref={searchRef} className="relative flex gap-2 px-2 sm:px-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search schools or enter URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-11 text-sm"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute top-full mt-2 w-full z-50 max-h-[60vh] sm:max-h-96 overflow-y-auto bg-background">
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
                        <div className="font-medium text-xs sm:text-sm">{suggestion.title}</div>
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
              <Card className="p-3 text-center text-xs sm:text-sm text-muted-foreground bg-background">
                Loading suggestions...
              </Card>
            </div>
          )}
        </div>
        <Button onClick={handleSearch} size="lg" className="px-4 sm:px-6 text-sm">
          Add
        </Button>
      </div>
    </>
  );
};

export default SearchBar;
