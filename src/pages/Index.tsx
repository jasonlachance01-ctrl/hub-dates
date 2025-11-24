import { useState, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import OrganizationCarousel from "@/components/OrganizationCarousel";
import OnboardingDialog from "@/components/OnboardingDialog";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Organization } from "@/types";
import { supabase } from "@/integrations/supabase/client";
const Index = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingOrg, setPendingOrg] = useState<Organization | null>(null);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [calendarConnected, setCalendarConnected] = useState(() => {
    // Check localStorage to see if calendar was already connected
    return localStorage.getItem('calendarConnected') === 'true';
  });
  const [userCount, setUserCount] = useState(0);

  // Fetch real user count from database
  useEffect(() => {
    const fetchUserCount = async () => {
      const { count, error } = await supabase
        .from('user_emails')
        .select('*', { count: 'exact', head: true });
      
      if (!error && count !== null) {
        setUserCount(count);
      }
    };

    fetchUserCount();

    // Set up realtime subscription for user count updates
    const channel = supabase
      .channel('user-emails-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_emails'
        },
        () => {
          fetchUserCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const handleAddOrganization = (org: Organization) => {
    setOrganizations(prev => [...prev, org]);
  };
  const handleRemoveOrganization = (id: string) => {
    setOrganizations(prev => prev.filter(org => org.id !== id));
  };
  const handleUpdateOrganization = (id: string, updatedOrg: Organization) => {
    setOrganizations(prev => prev.map(org => org.id === id ? updatedOrg : org));
  };
  const handleAddToCalendar = (orgId: string, onSuccess: () => void) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setPendingOrg(org);
      setPendingCallback(() => onSuccess());
      setShowOnboarding(true);
    }
  };
  const handleStarterPlanSelect = () => {
    setShowOnboarding(false);
    setPendingOrg(null);
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  };
  const handleCalendarConnect = () => {
    setCalendarConnected(true);
    setShowOnboarding(false);
    // Save to localStorage so it persists
    localStorage.setItem('calendarConnected', 'true');
    setPendingOrg(null);
  };
  const handleSearchPerformed = () => {
    // No longer needed - user count is fetched from database
  };
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header Section */}
      <header className="flex-shrink-0 px-4 pt-6 pb-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground leading-tight">
              Academic<br />Annual
            </h1>
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
            <h2 className="font-bold leading-tight text-neutral-700 text-4xl font-serif">Subscribe to all of Your School Year Events</h2>
            <p className="font-bold leading-tight italic text-primary text-center font-serif text-4xl">in one Place!</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter the name or URL of any Elementary, Middle, High-School, or College to add to your feed then select the important dates from their calendar to import into your own!
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            Include City and State for accurate results.
          </p>
          <div className="flex gap-3 mt-4 max-w-sm mx-auto">
            <Input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-11 text-sm"
            />
            <Input
              type="text"
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="h-11 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-4 pb-6 pt-8 md:pt-0 overflow-hidden">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          {organizations.length === 0 ? <div className="flex-1 flex flex-col justify-end pb-20">
              <div className="w-full space-y-8 mb-8">
                <SearchBar onAdd={handleAddOrganization} onSearchPerformed={handleSearchPerformed} city={city} state={state} />
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
              <SearchBar onAdd={handleAddOrganization} onSearchPerformed={handleSearchPerformed} city={city} state={state} />
              <div className="mt-8">
        <OrganizationCarousel organizations={organizations} onRemove={handleRemoveOrganization} onUpdate={handleUpdateOrganization} onAddToCalendar={handleAddToCalendar} />
              </div>
            </div>}
        </div>
      </main>

      {/* Onboarding Dialog */}
      <OnboardingDialog open={showOnboarding} onClose={() => {
      setShowOnboarding(false);
      setPendingOrg(null);
      setPendingCallback(null);
    }} onConnect={handleCalendarConnect} onStarterPlanSelect={handleStarterPlanSelect} pendingOrg={pendingOrg} />

      {/* Footer */}
      <Footer />
    </div>;
};
export default Index;