import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import OrganizationCarousel from "@/components/OrganizationCarousel";
import OnboardingDialog from "@/components/OnboardingDialog";
import { Organization } from "@/types";
const Index = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const handleAddOrganization = (org: Organization) => {
    setOrganizations(prev => [...prev, org]);
  };
  const handleRemoveOrganization = (id: string) => {
    setOrganizations(prev => prev.filter(org => org.id !== id));
  };
  const handleUpdateOrganization = (id: string, updatedOrg: Organization) => {
    setOrganizations(prev => prev.map(org => org.id === id ? updatedOrg : org));
  };
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header Section */}
      <header className="flex-shrink-0 px-4 pt-6 pb-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">Calsync</h1>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              Beta
            </span>
          </div>
          <SearchBar onAdd={handleAddOrganization} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-4 pb-6 overflow-hidden">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          {organizations.length === 0 ? <div className="flex-1 flex items-center justify-center">
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
                  Search for schools, teams, or organizations to add their important dates
                  to your feed
                </p>
              </div>
            </div> : <OrganizationCarousel organizations={organizations} onRemove={handleRemoveOrganization} onUpdate={handleUpdateOrganization} calendarConnected={calendarConnected} />}
        </div>
      </main>

      {/* Onboarding Dialog */}
      <OnboardingDialog open={showOnboarding && !calendarConnected} onClose={() => setShowOnboarding(false)} onConnect={() => {
      setCalendarConnected(true);
      setShowOnboarding(false);
    }} />
    </div>;
};
export default Index;