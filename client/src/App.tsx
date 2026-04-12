import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LoadingQueueProvider } from "./contexts/LoadingQueueContext";
import Home from "./pages/Home";
import APTLSSManagement from "./pages/APTLSSManagement";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import FounderDashboard from "./pages/FounderDashboard";
import WorkerDashboard from "./pages/WorkerDashboard";
import AdvancedScheduling from "./pages/AdvancedScheduling";
import ATISPhasesAnalysisDashboard from "./pages/ATISPhasesAnalysisDashboard";


function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/aptlss"} component={APTLSSManagement} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/calendar"} component={Calendar} />
      <Route path={"/advanced-scheduling"} component={AdvancedScheduling} />
      <Route path={"/atis-phases"} component={ATISPhasesAnalysisDashboard} />

      <Route path={"/founder"} component={FounderDashboard} />
      <Route path={"/worker"} component={WorkerDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <LoadingQueueProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LoadingQueueProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
