import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LoadingQueueProvider } from "./contexts/LoadingQueueContext";

const Home = lazy(() => import("./pages/Home"));
const APTLSSManagement = lazy(() => import("./pages/APTLSSManagement"));
const Settings = lazy(() => import("./pages/Settings"));
const Calendar = lazy(() => import("./pages/Calendar"));
const FounderDashboard = lazy(() => import("./pages/FounderDashboard"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const AdvancedScheduling = lazy(() => import("./pages/AdvancedScheduling"));
const ATISPhasesAnalysisDashboard = lazy(
  () => import("./pages/ATISPhasesAnalysisDashboard")
);

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 h-2 w-24 animate-pulse rounded-full bg-primary/20" />
        <div className="mb-3 h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted/80" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-muted/60" />
      </div>
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
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
    </Suspense>
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
