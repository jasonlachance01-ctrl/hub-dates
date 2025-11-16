import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EventSelectionDialog from "./EventSelectionDialog";
import { Organization, EventType } from "@/types";
import { toast } from "sonner";

interface SearchBarProps {
  onAdd: (organization: Organization) => void;
}

const SearchBar = ({ onAdd }: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [pendingOrgName, setPendingOrgName] = useState("");

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

  const handleEventSelection = (selectedEvents: EventType[]) => {
    const newOrg: Organization = {
      id: Date.now().toString(),
      name: pendingOrgName,
      url: searchQuery.includes(".") ? searchQuery : undefined,
      events: selectedEvents,
    };

    onAdd(newOrg);
    setSearchQuery("");
    setShowEventDialog(false);
    toast.success(`${pendingOrgName} added to your feed`);
  };

  return (
    <>
      <div className="flex gap-2">
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
