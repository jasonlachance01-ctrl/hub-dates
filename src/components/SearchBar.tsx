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
}

interface SearchSuggestion {
  title: string;
  link: string;
  snippet: string;
}

const SearchBar = ({ onAdd }: SearchBarProps) => {
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

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.title);
    setShowSuggestions(false);
    handleSearchWithName(suggestion.title, suggestion.link);
  };

  const handleSearchWithName = (name: string, url?: string) => {
    setPendingOrgName(name);
    setShowEventDialog(true);
  };

  const handleEventSelection = (selectedEvents: EventType[]) => {
    const newOrg: Organization = {
      id: Date.now().toString(),
      name: pendingOrgName,
      url: searchQuery.includes(".") ? searchQuery : undefined,
      events: selectedEvents,
    };

    onAdd(newOrg);
    setSearchQuery("");
    setSuggestions([]);
    setShowEventDialog(false);
    toast.success(`${pendingOrgName} added to your feed`);
  };

  return (
    <>
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
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left p-3 hover:bg-accent transition-colors border-b last:border-b-0"
                >
                  <div className="font-medium text-sm">{suggestion.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {suggestion.snippet}
                  </div>
                </button>
              ))}
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
