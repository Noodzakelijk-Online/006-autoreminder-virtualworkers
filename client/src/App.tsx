import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LoadingQueueProvider } from "./contexts/LoadingQueueContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import APTLSSManagement from "./pages/APTLSSManagement";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import FounderDashboard from "./pages/FounderDashboard";
import AdvancedScheduling from "./pages/AdvancedScheduling";
import ATISPhasesAnalysisDashboard from "./pages/ATISPhasesAnalysisDashboard";
import RobertDashboard from "./pages/manus/RobertDashboard";
import PriorityCommandCenter from "./pages/manus/PriorityCommandCenter";
import AdminMonitor from "./pages/manus/AdminMonitor";
import { ProtectedRoute } from "./components/ProtectedRoute";
import WorkerOperator from "./pages/worker/WorkerOperator";


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
        <Route path={"/robert"} component={() => <ProtectedRoute component={RobertDashboard} allowedRoles={["admin"]} />} />
        <Route path={"/command-center"} component={() => <ProtectedRoute component={PriorityCommandCenter} allowedRoles={["admin"]} />} />
        <Route path={"/admin"} component={() => <ProtectedRoute component={AdminMonitor} allowedRoles={["admin"]} />} />
        <Route path={"/worker/operations"} component={() => <Redirect to="/worker" replace />} />
        <Route path={"/worker/plan"} component={() => <ProtectedRoute component={() => <WorkerOperator view="plan" />} allowedRoles={["worker"]} />} />
        <Route path={"/worker/decisions"} component={() => <ProtectedRoute component={() => <WorkerOperator view="decisions" />} allowedRoles={["worker"]} />} />
        <Route path={"/worker/evidence"} component={() => <ProtectedRoute component={() => <WorkerOperator view="evidence" />} allowedRoles={["worker"]} />} />
        <Route path={"/worker/settings"} component={() => <ProtectedRoute component={() => <WorkerOperator view="settings" />} allowedRoles={["worker"]} />} />
        <Route path={"/worker"} component={() => <ProtectedRoute component={WorkerOperator} allowedRoles={["worker"]} />} />
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
        defaultTheme="dark"
        switchable
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
