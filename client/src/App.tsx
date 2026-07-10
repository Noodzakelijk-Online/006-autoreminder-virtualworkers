import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LoadingQueueProvider } from "./contexts/LoadingQueueContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import APTLSSManagement from "./pages/APTLSSManagement";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import FounderDashboard from "./pages/FounderDashboard";
import WorkerDashboard from "./pages/WorkerDashboard";
import AdvancedScheduling from "./pages/AdvancedScheduling";
import ATISPhasesAnalysisDashboard from "./pages/ATISPhasesAnalysisDashboard";
import { ProtectedRoute } from "./components/ProtectedRoute";


function Router() {
  // All routes are wrapped in DashboardLayout which handles authentication
  // and shows the login form when user is not authenticated
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={() => <ProtectedRoute component={Home} allowedRoles={["admin"]} />} />
        <Route path={"/aptlss"} component={() => <ProtectedRoute component={APTLSSManagement} allowedRoles={["admin"]} />} />
        <Route path={"/settings"} component={() => <ProtectedRoute component={Settings} allowedRoles={["admin"]} />} />
        <Route path={"/calendar"} component={() => <ProtectedRoute component={Calendar} allowedRoles={["admin"]} />} />
        <Route path={"/advanced-scheduling"} component={() => <ProtectedRoute component={AdvancedScheduling} allowedRoles={["admin"]} />} />
        <Route path={"/atis-phases"} component={() => <ProtectedRoute component={ATISPhasesAnalysisDashboard} allowedRoles={["admin"]} />} />

        <Route path={"/founder"} component={() => <ProtectedRoute component={FounderDashboard} allowedRoles={["admin"]} />} />
        <Route path={"/worker"} component={() => <ProtectedRoute component={WorkerDashboard} allowedRoles={["worker"]} />} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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
