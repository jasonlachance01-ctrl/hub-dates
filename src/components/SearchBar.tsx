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
  const [selectedOrgName, setSelectedOrgName] = useState(""); // Store cleaned name when suggestion is selected
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
      // Skip if query too short or fetching disabled
      if (searchQuery.trim().length < 2 || !shouldFetchSuggestions) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        // Add timeout for suggestion fetching (shorter than main search)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Suggestion fetch timeout')), 10000)
        );

        const fetchPromise = supabase.functions.invoke("search-suggestions", {
          body: { query: searchQuery },
        });

        const { data, error } = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]) as any;

        if (error) {
          console.warn("Error fetching suggestions:", error);
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        // Validate and prioritize suggestions
        if (data?.suggestions && Array.isArray(data.suggestions)) {
          const prioritized = prioritizeSuggestions(data.suggestions);
          setSuggestions(prioritized);
          setShowSuggestions(prioritized.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        // Fail silently for suggestions - don't interrupt user flow
        console.warn("Failed to fetch suggestions:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, shouldFetchSuggestions]);

  const handleSearch = async () => {
    // Input validation
    if (!searchQuery.trim()) {
      toast.error("Please enter a school or organization name");
      return;
    }

    // Validate input with comprehensive error handling
    const validation = validateOrganizationInput(searchQuery.trim());
    if (!validation.success) {
      toast.error(validation.error || "Please enter a valid organization name or URL");
      return;
    }

    // Use selectedOrgName if user clicked a suggestion, otherwise use their direct input
    const organizationName = selectedOrgName || searchQuery.trim();

    // Fetch event dates with comprehensive error handling
    const loadingToast = toast.loading(`Fetching dates for ${organizationName}...`);

    try {
      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      const fetchPromise = supabase.functions.invoke("fetch-event-dates", {
        body: { organizationName }
      });

      const { data, error } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        // Handle specific error types
        if (error.message?.includes('timeout')) {
          throw new Error('Request timed out. Please try again.');
        }
        throw error;
      }

      // Validate response data
      if (!data) {
        throw new Error('No data received from server');
      }

      const events = (data.eventDates || [])
        .filter((ed: any) => ed.date)
        .map((ed: any, index: number) => ({
          id: `${ed.eventName.toLowerCase().replace(/\s+/g, '-')}-${index}`,
          name: ed.eventName,
          date: ed.date,
          addedToCalendar: false
        }));

      // Create organization object
      const newOrg: Organization = {
        id: Date.now().toString(),
        name: organizationName,
        url: searchQuery.includes(".") ? searchQuery : undefined,
        events,
      };

      // Success - update state and notify user
      onAdd(newOrg);
      setSearchQuery("");
      setSelectedOrgName("");
      setSuggestions([]);
      setShouldFetchSuggestions(true);
      onSearchPerformed?.();
      
      toast.dismiss(loadingToast);
      
      if (events.length === 0) {
        toast.success(`${organizationName} added (no upcoming events found)`);
      } else {
        toast.success(`${organizationName} added with ${events.length} event${events.length === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error("Error fetching event dates:", error);
      toast.dismiss(loadingToast);
      
      // Provide specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('timeout')) {
        toast.error("Request timed out. The server may be busy, please try again.");
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error("Network error. Please check your connection and try again.");
      } else if (errorMessage.includes('credentials') || errorMessage.includes('API')) {
        toast.error("Service configuration error. Please contact support.");
      } else {
        toast.error("Could not fetch event dates. Please verify the organization name and try again.");
      }
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
    // Store the cleaned name to use for search and card display
    setSelectedOrgName(cleanName);
    setSearchQuery(cleanName);
    setShowSuggestions(false);
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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Clear selected org name when user manually edits after selecting a suggestion
              if (selectedOrgName) {
                setSelectedOrgName("");
                setShouldFetchSuggestions(true);
              }
            }}
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
