import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AnalysisPage from "./pages/AnalysisPage";
import VerdictPage from "./pages/VerdictPage";
import ThreatIntelPage from "./pages/ThreatIntelPage";
import NetworkPage from "./pages/NetworkPage";
import MyScansPage from "./pages/MyScansPage";
import AboutPage from "./pages/AboutPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/verdict/:id" element={<VerdictPage />} />
          <Route path="/threat-intel" element={<ThreatIntelPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/my-scans" element={<MyScansPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
