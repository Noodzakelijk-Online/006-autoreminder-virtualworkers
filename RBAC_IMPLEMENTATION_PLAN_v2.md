# Role-Based Access Control (RBAC) Implementation Plan v2
## VA Task Dashboard - Refined Architecture

---

## 1. System Overview

This is a **closed internal system** with no public signup or guest access. Workers are created by admins and log in with credentials provided by the admin.

**Two-Role Model**:
- **admin**: Full system access, management capabilities
- **worker**: Limited access to assigned tasks and personal data

---

## 2. Role Definitions & Responsibilities

### Admin Role
**Responsibilities**:
- Create and manage workers (add, edit, delete)
- Create, assign, and manage all tasks
- View all tasks and worker analytics
- Manage system settings and integrations
- Configure working hours and schedules
- View audit logs and system health

**Access**:
- All features and data
- All pages and routes
- All API endpoints

### Worker Role
**Responsibilities**:
- View only tasks assigned to them
- Update task status and progress
- View personal schedule
- View personal productivity metrics
- Manage personal working hours settings

**Access**:
- Limited to assigned tasks only
- Personal dashboard and schedule
- Personal profile settings
- Limited analytics (personal only)

---

## 3. Task Data Model

### Current Task Structure (from Trello)
Tasks come from Trello and need to track:

```
Task {
  id: string (Trello card ID)
  title: string
  description: string
  status: string (e.g., "To Do", "In Progress", "Done")
  priority: string (e.g., "Critical", "High", "Medium", "Low")
  dueDate: timestamp
  estimatedHours: number
  completedHours: number
  checklist: ChecklistItem[]
  board: string (Trello board name)
  workspace: string (Trello workspace)
  
  // RBAC Fields (NEW)
  createdBy: string (admin openId who created/imported the task)
  assignedTo: string (worker openId who is responsible)
  
  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Worker Visibility Rule
Workers can only see tasks where:
```
assignedTo === currentUser.openId
```

### Task Update Authorization
Before allowing any task update, verify:
```
task.assignedTo === currentUser.openId OR currentUser.role === 'admin'
```

---

## 4. Backend Implementation

### 4.1 Database Schema Changes

**Extend existing users table** (already has role field):
```sql
-- No changes needed, role column already exists
-- Ensure all users have role = 'admin' or 'worker'
```

**Extend tasks table** (from Trello integration):
```sql
ALTER TABLE tasks ADD COLUMN createdBy VARCHAR(64);
ALTER TABLE tasks ADD COLUMN assignedTo VARCHAR(64);
ALTER TABLE tasks ADD FOREIGN KEY (createdBy) REFERENCES users(openId);
ALTER TABLE tasks ADD FOREIGN KEY (assignedTo) REFERENCES users(openId);
```

### 4.2 Backend Middleware Structure

**File**: `server/_core/rbac.ts` (NEW)

```typescript
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./trpc";

/**
 * Admin-only procedure
 * Rejects non-admin users with FORBIDDEN error
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }
  return next({ ctx });
});

/**
 * Worker procedure
 * Allows both admins and workers
 */
export const workerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'worker') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Worker or admin access required'
    });
  }
  return next({ ctx });
});
```

**File**: `shared/permissions.ts` (NEW)

```typescript
/**
 * Centralized permission helpers
 * Used by both backend and frontend
 */

export type UserRole = 'admin' | 'worker';

export interface User {
  id: number;
  openId: string;
  role: UserRole;
  name: string;
  email: string;
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

/**
 * Check if user is worker
 */
export function isWorker(user: User | null): boolean {
  return user?.role === 'worker';
}

/**
 * Check if user can access task
 * Admin can access all tasks
 * Worker can only access assigned tasks
 */
export function canAccessTask(
  user: User | null,
  task: { assignedTo: string }
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return task.assignedTo === user.openId;
}

/**
 * Check if user can modify task
 * Admin can modify all tasks
 * Worker can only modify assigned tasks
 */
export function canModifyTask(
  user: User | null,
  task: { assignedTo: string }
): boolean {
  return canAccessTask(user, task);
}

/**
 * Check if user can manage workers
 * Only admin can manage workers
 */
export function canManageWorkers(user: User | null): boolean {
  return isAdmin(user);
}

/**
 * Check if user can view analytics
 * Admin can view all analytics
 * Worker can view only personal analytics
 */
export function canViewAnalytics(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'worker';
}

/**
 * Get analytics scope for user
 * Admin: all workers
 * Worker: self only
 */
export function getAnalyticsScope(user: User | null): 'all' | 'self' {
  return isAdmin(user) ? 'all' : 'self';
}
```

### 4.3 Backend Endpoint Protection

**Admin-Only Endpoints** (use `adminProcedure`):
```typescript
// Worker Management
router({
  workers: {
    create: adminProcedure.mutation(...),
    update: adminProcedure.mutation(...),
    delete: adminProcedure.mutation(...),
    list: adminProcedure.query(...),
  },
  
  // Task Management
  tasks: {
    create: adminProcedure.mutation(...),
    delete: adminProcedure.mutation(...),
    assign: adminProcedure.mutation(...),
    bulkAssign: adminProcedure.mutation(...),
  },
  
  // System Settings
  settings: {
    update: adminProcedure.mutation(...),
    getSystem: adminProcedure.query(...),
  },
  
  // Analytics
  analytics: {
    getAllWorkers: adminProcedure.query(...),
    getSystemMetrics: adminProcedure.query(...),
  }
})
```

**Worker Endpoints** (use `workerProcedure` with data filtering):
```typescript
router({
  tasks: {
    // Returns only tasks assigned to current user
    list: workerProcedure.query(({ ctx }) => {
      return db.select()
        .from(tasks)
        .where(eq(tasks.assignedTo, ctx.user.openId));
    }),
    
    // Update only if assigned to current user
    update: workerProcedure.mutation(({ ctx, input }) => {
      const task = db.select().from(tasks)
        .where(eq(tasks.id, input.taskId));
      
      if (task.assignedTo !== ctx.user.openId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      
      return db.update(tasks)
        .set(input.updates)
        .where(eq(tasks.id, input.taskId));
    }),
  },
  
  schedule: {
    // Get personal schedule
    get: workerProcedure.query(({ ctx }) => {
      return db.select()
        .from(userWorkingHours)
        .where(eq(userWorkingHours.userOpenId, ctx.user.openId));
    }),
    
    // Update personal schedule
    update: workerProcedure.mutation(({ ctx, input }) => {
      return db.update(userWorkingHours)
        .set(input)
        .where(eq(userWorkingHours.userOpenId, ctx.user.openId));
    }),
  },
  
  analytics: {
    // Get personal analytics only
    getPersonal: workerProcedure.query(({ ctx }) => {
      return getWorkerAnalytics(ctx.user.openId);
    }),
  }
})
```

---

## 5. Frontend Implementation

### 5.1 Project Structure (Feature-Based)

```
client/src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── dashboard/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── tasks/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── workers/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── schedule/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── analytics/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── settings/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── types.ts
│   └── aptlss/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── types.ts
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── permissions.ts
│   └── types.ts
├── App.tsx
└── main.tsx
```

### 5.2 Protected Route Component

**File**: `shared/components/ProtectedRoute.tsx` (NEW)

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import { UserRole } from "@shared/permissions";
import { ReactNode } from "react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallback
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    setLocation('/login');
    return null;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role as UserRole)) {
      return fallback || <AccessDenied />;
    }
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">
          You don't have permission to access this page.
        </p>
      </div>
    </div>
  );
}
```

### 5.3 Permission Hook

**File**: `shared/hooks/usePermission.ts` (NEW)

```typescript
import { useAuth } from "@/_core/hooks/useAuth";
import {
  isAdmin,
  isWorker,
  canAccessTask,
  canManageWorkers,
  getAnalyticsScope,
  type User
} from "@shared/permissions";

export function usePermission() {
  const { user } = useAuth();

  return {
    user,
    isAdmin: () => isAdmin(user),
    isWorker: () => isWorker(user),
    canAccessTask: (task: { assignedTo: string }) =>
      canAccessTask(user, task),
    canManageWorkers: () => canManageWorkers(user),
    getAnalyticsScope: () => getAnalyticsScope(user),
  };
}
```

### 5.4 Route Protection in App.tsx

**File**: `client/src/App.tsx` (MODIFIED)

```typescript
import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { Route, Switch } from "wouter";

// Admin-only pages
import WorkersPage from "@/features/workers/pages/WorkersPage";
import SettingsPage from "@/features/settings/pages/SettingsPage";
import AnalyticsPage from "@/features/analytics/pages/AnalyticsPage";
import APTLSSManagementPage from "@/features/aptlss/pages/APTLSSManagementPage";

// Worker pages
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import MyTasksPage from "@/features/tasks/pages/MyTasksPage";
import MySchedulePage from "@/features/schedule/pages/MySchedulePage";
import ProfilePage from "@/features/auth/pages/ProfilePage";

function Router() {
  return (
    <Switch>
      {/* Admin-only routes */}
      <Route path="/workers">
        <ProtectedRoute requiredRole="admin">
          <WorkersPage />
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute requiredRole="admin">
          <SettingsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/analytics">
        <ProtectedRoute requiredRole="admin">
          <AnalyticsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/aptlss-management">
        <ProtectedRoute requiredRole="admin">
          <APTLSSManagementPage />
        </ProtectedRoute>
      </Route>

      {/* Worker accessible routes */}
      <Route path="/">
        <ProtectedRoute requiredRole={["admin", "worker"]}>
          <DashboardPage />
        </ProtectedRoute>
      </Route>

      <Route path="/my-tasks">
        <ProtectedRoute requiredRole={["admin", "worker"]}>
          <MyTasksPage />
        </ProtectedRoute>
      </Route>

      <Route path="/my-schedule">
        <ProtectedRoute requiredRole={["admin", "worker"]}>
          <MySchedulePage />
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute requiredRole={["admin", "worker"]}>
          <ProfilePage />
        </ProtectedRoute>
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}
```

### 5.5 Conditional UI Rendering

**Example**: Navigation menu based on role

```typescript
import { usePermission } from "@/shared/hooks/usePermission";

export function Navigation() {
  const { isAdmin, isWorker } = usePermission();

  return (
    <nav>
      <NavItem href="/" label="Dashboard" />

      {isWorker() && (
        <>
          <NavItem href="/my-tasks" label="My Tasks" />
          <NavItem href="/my-schedule" label="My Schedule" />
        </>
      )}

      {isAdmin() && (
        <>
          <NavItem href="/workers" label="Workers" />
          <NavItem href="/analytics" label="Analytics" />
          <NavItem href="/aptlss-management" label="APTLSS" />
          <NavItem href="/settings" label="Settings" />
        </>
      )}

      <NavItem href="/profile" label="Profile" />
    </nav>
  );
}
```

---

## 6. Files to Create

### Backend Files
1. `server/_core/rbac.ts` - Admin and worker procedures
2. `shared/permissions.ts` - Centralized permission helpers
3. `server/db.ts` - Update queries to use permission helpers

### Frontend Files
1. `shared/components/ProtectedRoute.tsx` - Route protection component
2. `shared/hooks/usePermission.ts` - Permission checking hook
3. `features/workers/pages/WorkersPage.tsx` - Worker management
4. `features/workers/components/WorkerForm.tsx` - Create/edit worker
5. `features/workers/components/WorkerList.tsx` - List workers
6. `features/tasks/pages/MyTasksPage.tsx` - Worker task view
7. `features/schedule/pages/MySchedulePage.tsx` - Worker schedule
8. `features/analytics/pages/AnalyticsPage.tsx` - Analytics dashboard

### Files to Modify
1. `server/routers.ts` - Add admin/worker procedures to endpoints
2. `client/src/App.tsx` - Add route protection
3. `client/src/components/DashboardLayout.tsx` - Update navigation
4. `drizzle/schema.ts` - Add createdBy and assignedTo to tasks

---

## 7. Implementation Sequence

### Phase 1: Backend Foundation (Day 1-2)
- [ ] Create `server/_core/rbac.ts` with admin/worker procedures
- [ ] Create `shared/permissions.ts` with permission helpers
- [ ] Update database schema to add createdBy and assignedTo fields
- [ ] Update existing endpoints to use adminProcedure/workerProcedure
- [ ] Add data filtering to task endpoints

### Phase 2: Frontend Structure (Day 3)
- [ ] Reorganize frontend to feature-based structure
- [ ] Create `ProtectedRoute` component
- [ ] Create `usePermission` hook
- [ ] Update App.tsx with route protection

### Phase 3: Worker Features (Day 4-5)
- [ ] Create MyTasksPage (filtered to assigned tasks)
- [ ] Create MySchedulePage
- [ ] Create worker-specific dashboard
- [ ] Update navigation menu

### Phase 4: Admin Features (Day 6-7)
- [ ] Create WorkersPage with CRUD operations
- [ ] Create worker assignment interface
- [ ] Create admin analytics page
- [ ] Update admin settings page

### Phase 5: Testing & Refinement (Day 8)
- [ ] Test all role transitions
- [ ] Verify data isolation
- [ ] Test permission enforcement
- [ ] Security audit
- [ ] Performance testing

---

## 8. Safety Rules

✅ **DO**:
- Only modify files necessary for RBAC
- Keep changes incremental
- Test after each phase
- Use existing infrastructure (role column, procedures)
- Document all changes

❌ **DON'T**:
- Refactor unrelated code
- Create unnecessary tables
- Modify working APIs unless required
- Break existing functionality
- Hardcode role checks (use permission helpers)

---

## 9. Success Criteria

✅ **Backend**:
- All admin endpoints reject non-admin users
- All worker endpoints filter data by user
- All mutations verify ownership before allowing changes
- No data leakage between workers

✅ **Frontend**:
- Admin sees all features
- Workers see only their data
- Routes are protected
- Buttons hidden appropriately
- No console errors

✅ **Security**:
- Workers cannot access admin pages
- Workers cannot see other workers' tasks
- All validation happens server-side
- No sensitive data in localStorage

---

## Summary

This RBAC implementation will:
- ✅ Use existing `role` column (no new tables)
- ✅ Implement backend procedures (`adminProcedure`, `workerProcedure`)
- ✅ Protect routes with `ProtectedRoute` component
- ✅ Centralize permissions in `permissions.ts`
- ✅ Use feature-based frontend structure
- ✅ Maintain security and data isolation
- ✅ Keep changes incremental and safe

**Ready for implementation after approval.**
