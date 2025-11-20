import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-24 h-24 rounded-3xl overflow-hidden shadow-lg">
            <img 
              src="/icon-option-6-blue.png" 
              alt="Academic Annual Icon" 
              className="w-full h-full object-cover"
            />
          </div>
          <CardTitle className="text-2xl">Install Academic Annual</CardTitle>
          <CardDescription>
            Add Academic Annual to your home screen for quick access to all your event subscriptions
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isInstallable ? (
            <Button 
              onClick={handleInstall} 
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-5 w-5" />
              Install App
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  On Mobile
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p><strong>iPhone/iPad:</strong> Tap the Share button, then "Add to Home Screen"</p>
                  <p><strong>Android:</strong> Tap the menu (⋮), then "Add to Home Screen" or "Install App"</p>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Benefits of Installing</h3>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Quick access from your home screen</li>
                  <li>Works offline</li>
                  <li>Faster loading times</li>
                  <li>Native app-like experience</li>
                </ul>
              </div>
            </div>
          )}
          
          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="w-full"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
