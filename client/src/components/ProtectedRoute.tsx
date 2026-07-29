import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  allowedRoles: Array<"admin" | "worker" | "user">;
}

export function ProtectedRoute({ component: Component, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // If not authenticated, DashboardLayout shows the login form.
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === "worker") {
      return <Redirect to="/worker" />;
    }
    if (user.role === "admin") {
      return <Redirect to="/" />;
    }
    
    // Default fallback: show access pending/restricted screen for "user" role
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-background rounded-lg border shadow-sm">
        <h2 className="text-2xl font-bold text-destructive mb-2">Access Pending</h2>
        <p className="text-muted-foreground max-w-md">
          Your account is registered but does not have permission to view this page.
          Please ask an administrator to assign your role.
        </p>
      </div>
    );
  }

  return <Component />;
}
