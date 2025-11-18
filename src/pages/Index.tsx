import { useState, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import OrganizationCarousel from "@/components/OrganizationCarousel";
import OnboardingDialog from "@/components/OnboardingDialog";
import { Organization } from "@/types";

const Index = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingOrg, setPendingOrg] = useState<Organization | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(() => {
    // Check localStorage to see if calendar was already connected
    return localStorage.getItem('calendarConnected') === 'true';
  });
  const [userCount, setUserCount] = useState(() => {
    // Get user count from localStorage
    const stored = localStorage.getItem('userCount');
    return stored ? parseInt(stored, 10) : 0;
  });
  const handleAddOrganization = (org: Organization) => {
    setOrganizations(prev => [...prev, org]);
  };
  const handleRemoveOrganization = (id: string) => {
    setOrganizations(prev => prev.filter(org => org.id !== id));
  };
  const handleUpdateOrganization = (id: string, updatedOrg: Organization) => {
    setOrganizations(prev => prev.map(org => org.id === id ? updatedOrg : org));
  };
  const handleAddToCalendar = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setPendingOrg(org);
      setShowOnboarding(true);
    }
  };
  
  const handleStarterPlanSelect = () => {
    setShowOnboarding(false);
    setPendingOrg(null);
  };
  
  const handleCalendarConnect = () => {
    setCalendarConnected(true);
    setShowOnboarding(false);
    // Save to localStorage so it persists
    localStorage.setItem('calendarConnected', 'true');
    setPendingOrg(null);
  };

  const handleSearchPerformed = () => {
    const newCount = userCount + 1;
    setUserCount(newCount);
    localStorage.setItem('userCount', newCount.toString());
  };

  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header Section */}
      <header className="flex-shrink-0 px-4 pt-6 pb-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Calsync</h1>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-secondary/10 border border-border rounded-full">
                <span className="text-xs font-semibold text-foreground">
                  Users: {userCount}
                </span>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                Beta
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-shrink-0 px-4 py-8">
        <div className="max-w-md mx-auto text-center space-y-6">
          <div>
            <h2 className="font-bold leading-tight text-neutral-700 text-4xl font-serif">Subscribe to all of Your Events</h2>
            <p className="font-bold leading-tight italic text-primary text-center font-serif text-4xl">in one Place!</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter the name or URL of any School, Organization, or Team to add to your feed then select the important dates from their calendar to import into your own!
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            When searching for schools include City name for accurate results.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-4 pb-6 overflow-hidden">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          {organizations.length === 0 ? <div className="flex-1 flex flex-col justify-end pb-20">
              <div className="w-full space-y-8 mb-8">
                <SearchBar onAdd={handleAddOrganization} onSearchPerformed={handleSearchPerformed} />
                <div className="text-center space-y-3 px-6">
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">
                    No calendars yet
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Search above to get started with your first calendar.
                  </p>
                </div>
              </div>
            </div> : <div className="flex flex-col justify-end pb-20 space-y-8">
              <SearchBar onAdd={handleAddOrganization} onSearchPerformed={handleSearchPerformed} />
              <div className="mt-8">
        <OrganizationCarousel
          organizations={organizations}
          onRemove={handleRemoveOrganization}
          onUpdate={handleUpdateOrganization}
          onAddToCalendar={handleAddToCalendar}
        />
              </div>
            </div>}
        </div>
      </main>

      {/* Onboarding Dialog */}
      <OnboardingDialog 
        open={showOnboarding} 
        onClose={() => {
          setShowOnboarding(false);
          setPendingOrg(null);
        }}
        onConnect={handleCalendarConnect}
        onStarterPlanSelect={handleStarterPlanSelect}
        pendingOrg={pendingOrg}
      />
    </div>;
};
export default Index;