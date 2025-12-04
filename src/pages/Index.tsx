import { useState, useEffect } from "react";
import SearchBar from "@/components/SearchBar";
import OrganizationCarousel from "@/components/OrganizationCarousel";
import OnboardingDialog from "@/components/OnboardingDialog";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Organization } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
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
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  // Fetch real user count and average rating from database
  useEffect(() => {
    const fetchUserCount = async () => {
      const {
        count,
        error
      } = await supabase.from('user_emails').select('*', {
        count: 'exact',
        head: true
      });
      if (!error && count !== null) {
        setUserCount(count);
      }
    };

    const fetchAverageRating = async () => {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('rating');
      
      if (!error && data && data.length > 0) {
        const validRatings = data.filter(d => d.rating !== null);
        setReviewCount(validRatings.length);
        if (validRatings.length > 0) {
          const avg = validRatings.reduce((sum, d) => sum + (d.rating || 0), 0) / validRatings.length;
          setAverageRating(Math.round(avg * 10) / 10);
        }
      }
    };

    fetchUserCount();
    fetchAverageRating();

    // Set up realtime subscription for user count updates
    const channel = supabase.channel('user-emails-changes').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'user_emails'
    }, () => {
      fetchUserCount();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const handleAddOrganization = (org: Organization) => {
    setOrganizations(prev => [org, ...prev]);
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
      <header className="flex-shrink-0 px-4 pt-safe pt-4 sm:pt-6 pb-3 sm:pb-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">
              Academic<br />Annual
            </h1>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <div className="px-2 sm:px-3 py-1 bg-secondary/10 border border-border rounded-full">
                  <span className="text-[10px] sm:text-xs font-semibold text-foreground">
                    Users: {userCount}
                  </span>
                </div>
                <span className="px-2 sm:px-3 py-1 bg-primary/10 text-primary text-[10px] sm:text-xs font-semibold rounded-full">
                  Beta
                </span>
              </div>
              {averageRating !== null && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3 h-3 ${
                        star <= Math.round(averageRating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted-foreground/40"
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-foreground/70 ml-1">
                    ({reviewCount})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-shrink-0 px-4 py-4 sm:py-6">
        <div className="max-w-md mx-auto text-center space-y-4 sm:space-y-6">
          <div>
            <h2 className="font-bold leading-tight text-neutral-700 text-2xl sm:text-3xl md:text-4xl font-serif">Subscribe to all of Your School Year Events</h2>
            <p className="font-bold leading-tight italic text-primary text-center font-serif text-2xl sm:text-3xl md:text-4xl">in one Place!</p>
          </div>
          <p className="text-xs sm:text-sm text-foreground/70 leading-relaxed">Enter the name or URL of any Elementary, Middle, High-School, or College to add to your feed then select the important dates from their academic calendar to import into your own!</p>
          <p className="text-xs sm:text-sm text-foreground/70 leading-relaxed mt-2">
            Include City and State for accurate results.
          </p>
          <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4 max-w-sm mx-auto">
            <Input type="text" placeholder="City" value={city} onChange={e => setCity(e.target.value)} className="h-10 sm:h-11 text-xs sm:text-sm" />
            <Input type="text" placeholder="State" value={state} onChange={e => setState(e.target.value)} className="h-10 sm:h-11 text-xs sm:text-sm" />
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-4 pb-6">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
          {organizations.length === 0 ? <div className="flex-1 flex flex-col justify-start pb-16 sm:pb-20 pt-4">
              <div className="w-full space-y-6 sm:space-y-8 mb-6 sm:mb-8">
                <SearchBar onAdd={handleAddOrganization} onSearchPerformed={handleSearchPerformed} city={city} state={state} />
                <div className="text-center space-y-3 px-4 sm:px-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                    No calendars yet
                  </h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Search above to get started with your first calendar.
                  </p>
                </div>
              </div>
            </div> : <div className="flex flex-col justify-end pb-16 sm:pb-20 space-y-6 sm:space-y-8 pt-4">
              <SearchBar onAdd={handleAddOrganization} onSearchPerformed={handleSearchPerformed} city={city} state={state} />
              <div className="mt-4 sm:mt-8">
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
    }} onConnect={handleCalendarConnect} onStarterPlanSelect={handleStarterPlanSelect} organizations={organizations} />

      {/* Footer */}
      <Footer />
    </div>;
};
export default Index;