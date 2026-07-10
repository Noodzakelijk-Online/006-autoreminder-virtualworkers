import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { OwnerAccessGate } from "./components/OwnerAccessGate";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const RobertDashboard = lazy(() => import("./pages/RobertDashboard"));
const PriorityCommandCenter = lazy(() => import("./pages/PriorityCommandCenter"));
const AdminMonitor = lazy(() => import("./pages/AdminMonitor"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <OwnerAccessGate>{children}</OwnerAccessGate>;
}

function ProtectedHome() {
  return (
    <ProtectedRoute>
      <Home />
    </ProtectedRoute>
  );
}

function ProtectedRobertDashboard() {
  return (
    <ProtectedRoute>
      <RobertDashboard />
    </ProtectedRoute>
  );
}

function ProtectedPriorityCommandCenter() {
  return (
    <ProtectedRoute>
      <PriorityCommandCenter />
    </ProtectedRoute>
  );
}

function ProtectedAdminMonitor() {
  return (
    <ProtectedRoute>
      <AdminMonitor />
    </ProtectedRoute>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
      Loading Joyce dashboard...
    </div>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path={"/"} component={ProtectedHome} />
        <Route path={"/robert"} component={ProtectedRobertDashboard} />
        <Route path={"/command-center"} component={ProtectedPriorityCommandCenter} />
        <Route path={"/admin"} component={ProtectedAdminMonitor} />
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
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
