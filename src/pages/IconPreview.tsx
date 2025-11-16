import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

const IconPreview = () => {
  const navigate = useNavigate();

  const icons = [
    {
      id: 1,
      name: "Sync Gradient",
      description: "Blue-purple gradient with sync symbol",
      path: "/icon-option-1.png",
    },
    {
      id: 2,
      name: "Notification Coral",
      description: "Coral-orange gradient with notification bell",
      path: "/icon-option-2.png",
    },
    {
      id: 3,
      name: "Abstract Grid",
      description: "Teal-green gradient with geometric grid",
      path: "/icon-option-3.png",
    },
    {
      id: 4,
      name: "Date Number",
      description: "Minimalist date on blue-purple gradient",
      path: "/icon-option-4.png",
    },
    {
      id: 5,
      name: "Frame Dot",
      description: "Simple frame with dot, blue-purple gradient",
      path: "/icon-option-5.png",
    },
    {
      id: 6,
      name: "Checkmark",
      description: "Clean checkmark on blue-purple gradient",
      path: "/icon-option-6.png?v=2",
    },
    {
      id: 7,
      name: "Three Dots",
      description: "Circle with dots, blue-purple gradient",
      path: "/icon-option-7.png",
    },
  ];

  const handleDownload = (path: string, name: string) => {
    const link = document.createElement('a');
    link.href = path;
    link.download = `calsync-icon-${name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calsync Icon Options</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your favorite homescreen icon design
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back to App
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {icons.map((icon) => (
            <Card key={icon.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{icon.name}</CardTitle>
                <CardDescription>{icon.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Icon Display */}
                <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-2xl p-8 flex items-center justify-center">
                  <div className="relative">
                    <img
                      src={icon.path}
                      alt={icon.name}
                      className="w-48 h-48 rounded-3xl shadow-2xl"
                    />
                  </div>
                </div>

                {/* Preview Sizes */}
                <div className="flex gap-3 justify-center items-end">
                  <div className="text-center">
                    <img
                      src={icon.path}
                      alt={`${icon.name} - Small`}
                      className="w-12 h-12 rounded-xl shadow-md mx-auto mb-1"
                    />
                    <span className="text-xs text-muted-foreground">Small</span>
                  </div>
                  <div className="text-center">
                    <img
                      src={icon.path}
                      alt={`${icon.name} - Medium`}
                      className="w-16 h-16 rounded-xl shadow-md mx-auto mb-1"
                    />
                    <span className="text-xs text-muted-foreground">Medium</span>
                  </div>
                  <div className="text-center">
                    <img
                      src={icon.path}
                      alt={`${icon.name} - Large`}
                      className="w-20 h-20 rounded-xl shadow-md mx-auto mb-1"
                    />
                    <span className="text-xs text-muted-foreground">Large</span>
                  </div>
                </div>

                {/* Download Button */}
                <Button
                  onClick={() => handleDownload(icon.path, icon.name)}
                  className="w-full"
                  variant="secondary"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Icon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">How to use these icons</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Download your preferred icon using the button above</li>
            <li>• Icons are 512x512px, perfect for PWA and app store submissions</li>
            <li>• These will appear when users add Calsync to their homescreen</li>
            <li>• All icons follow modern design principles with clean, minimalist aesthetics</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default IconPreview;
