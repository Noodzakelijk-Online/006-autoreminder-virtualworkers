# Role-Based Access Control (RBAC) Implementation Plan
## VA Task Dashboard

---

## 1. RBAC System Overview

The Role-Based Access Control system will implement a **three-tier permission model** that controls what features, data, and actions each user can access based on their assigned role. This ensures:

- **Security**: Sensitive operations are restricted to authorized users only
- **Data Privacy**: Workers only see their own tasks and data
- **Scalability**: Easy to add new roles and permissions in the future
- **Audit Trail**: Track who performed what actions and when

### Core Principles

1. **Principle of Least Privilege**: Users get the minimum permissions needed for their role
2. **Explicit Permissions**: All access is explicitly granted, not assumed
3. **Role-Based Not User-Based**: Permissions are tied to roles, not individual users
4. **Separation of Concerns**: Admin features are completely separate from worker features

---

## 2. Role Definition

The system will have **three primary roles**:

### Role 1: OWNER/ADMIN
**Purpose**: Full system administration and project oversight

**Characteristics**:
- Typically the project creator or team lead
- Has complete access to all features
- Can manage other users and assign roles
- Can view all tasks, workers, and analytics
- Can configure system-wide settings

**Primary Responsibilities**:
- Monitor project progress and metrics
- Manage worker assignments and schedules
- Configure system settings and integrations
- Generate reports and analytics
- Manage billing and subscriptions (if applicable)

---

### Role 2: WORKER
**Purpose**: Task execution and personal productivity

**Characteristics**:
- Individual contributor assigned to complete tasks
- Can only see tasks assigned to them
- Can manage their own schedule and working hours
- Cannot access admin features or other workers' data
- Can participate in interviews for task understanding

**Primary Responsibilities**:
- Complete assigned tasks
- Update task status and progress
- Manage personal working hours and breaks
- Participate in ATIS interviews for task clarification
- Track personal productivity metrics

---

### Role 3: USER (Default/Guest)
**Purpose**: Limited read-only access or onboarding

**Characteristics**:
- New users before role assignment
- Limited to viewing public/shared information
- Cannot perform any write operations
- Used for trial or evaluation purposes
- Can be upgraded to Worker or Admin

**Primary Responsibilities**:
- View public dashboards (if any)
- Access help and documentation
- Request access or role upgrades

---

## 3. Permission Matrix

### 3.1 Dashboard & Navigation Access

| Feature | Owner/Admin | Worker | User |
|---------|------------|--------|------|
| **Home Dashboard** | ✅ Full | ✅ Personal | ✅ Read-only |
| **Task Timeline** | ✅ All Tasks | ✅ Assigned Only | ❌ No |
| **Calendar View** | ✅ All Tasks | ✅ Personal | ❌ No |
| **APTLSS Management** | ✅ Full | ❌ No | ❌ No |
| **VA Management** | ✅ Full | ❌ No | ❌ No |
| **Settings** | ✅ System-wide | ✅ Personal Only | ❌ No |
| **Analytics/Reports** | ✅ Full | ✅ Personal Only | ❌ No |

### 3.2 Task Management Permissions

| Action | Owner/Admin | Worker | User |
|--------|------------|--------|------|
| **View All Tasks** | ✅ Yes | ❌ No (Only Assigned) | ❌ No |
| **View Task Details** | ✅ All | ✅ Assigned Only | ❌ No |
| **Create Tasks** | ✅ Yes | ❌ No | ❌ No |
| **Edit Task** | ✅ All | ✅ Assigned Only | ❌ No |
| **Delete Task** | ✅ Yes | ❌ No | ❌ No |
| **Mark Complete** | ✅ All | ✅ Assigned Only | ❌ No |
| **Assign Task** | ✅ Yes | ❌ No | ❌ No |
| **Bulk Operations** | ✅ Yes | ❌ No | ❌ No |
| **Reschedule** | ✅ Yes | ✅ Personal Only | ❌ No |
| **Start Interview** | ✅ Yes | ✅ Assigned Only | ❌ No |

### 3.3 Worker Management Permissions

| Action | Owner/Admin | Worker | User |
|--------|------------|--------|------|
| **View All Workers** | ✅ Yes | ❌ No | ❌ No |
| **Create Worker** | ✅ Yes | ❌ No | ❌ No |
| **Edit Worker** | ✅ Yes | ❌ No | ❌ No |
| **Delete Worker** | ✅ Yes | ❌ No | ❌ No |
| **Assign Tasks** | ✅ Yes | ❌ No | ❌ No |
| **View Worker Schedule** | ✅ All | ✅ Self Only | ❌ No |
| **Edit Worker Schedule** | ✅ All | ✅ Self Only | ❌ No |
| **View Worker Stats** | ✅ All | ✅ Self Only | ❌ No |

### 3.4 System Configuration Permissions

| Action | Owner/Admin | Worker | User |
|--------|------------|--------|------|
| **System Settings** | ✅ Yes | ❌ No | ❌ No |
| **Integration Setup** | ✅ Yes | ❌ No | ❌ No |
| **API Key Management** | ✅ Yes | ❌ No | ❌ No |
| **User Role Management** | ✅ Yes | ❌ No | ❌ No |
| **Audit Logs** | ✅ Yes | ❌ No | ❌ No |
| **Backup/Export** | ✅ Yes | ❌ No | ❌ No |
| **Personal Settings** | ✅ Yes | ✅ Personal Only | ❌ No |

### 3.5 Interview & Analysis Permissions

| Action | Owner/Admin | Worker | User |
|--------|------------|--------|------|
| **Start Interview** | ✅ All Tasks | ✅ Assigned Only | ❌ No |
| **View Interview Results** | ✅ All | ✅ Own Only | ❌ No |
| **Generate APTLSS** | ✅ All | ✅ Own Tasks | ❌ No |
| **View Analytics** | ✅ Full | ✅ Personal | ❌ No |
| **Export Results** | ✅ All | ✅ Own Only | ❌ No |

### 3.6 Chatbot & Notifications Permissions

| Action | Owner/Admin | Worker | User |
|--------|------------|--------|------|
| **Receive Notifications** | ✅ All | ✅ Relevant Only | ❌ No |
| **Configure Notifications** | ✅ System-wide | ✅ Personal | ❌ No |
| **Chatbot Commands** | ✅ All | ✅ Limited | ❌ No |
| **View Message History** | ✅ All | ✅ Own Only | ❌ No |

---

## 4. UI/UX Restrictions by Role

### 4.1 Navigation Menu (Sidebar)

**Owner/Admin sees**:
- Dashboard
- Calendar
- APTLSS Management
- VA Management
- Settings (with system-wide options)
- Analytics/Reports

**Worker sees**:
- Dashboard (personal view)
- Calendar (personal view)
- Settings (personal only)
- My Tasks
- My Schedule

**User sees**:
- Help & Documentation
- Contact Support
- Request Access

### 4.2 Dashboard Layout

**Owner/Admin Dashboard**:
- Global task overview
- Team productivity metrics
- Worker utilization charts
- System health status
- Action buttons for bulk operations

**Worker Dashboard**:
- Personal task list
- Personal productivity metrics
- My schedule and working hours
- Personal performance stats
- My interview results

**User Dashboard**:
- Welcome message
- Feature overview
- Call-to-action for role upgrade
- Documentation links

### 4.3 Hidden/Disabled UI Elements

**For Workers**:
- "Create Task" button is hidden
- "Delete Task" button is hidden
- "Assign Task" button is hidden
- "Bulk Operations" menu is hidden
- "VA Management" tab is hidden
- "System Settings" is hidden
- Worker list is hidden
- Admin analytics are hidden

**For Users**:
- Almost all feature buttons are hidden or disabled
- Only help and documentation links are visible
- "Request Access" button is prominent

---

## 5. Technical Implementation Details

### 5.1 Database Schema

#### Current User Model (Already Exists)
```
users table:
- id (int, PK)
- openId (varchar, unique)
- name (text)
- email (varchar)
- loginMethod (varchar)
- role (enum: 'user', 'admin', 'worker')  ← Already exists!
- createdAt (timestamp)
- updatedAt (timestamp)
- lastSignedIn (timestamp)
```

**Status**: The `role` column already exists in the schema with three values: `user`, `admin`, `worker`. ✅

#### New Table: Role Permissions (Optional Enhancement)
```
role_permissions table:
- id (int, PK)
- roleId (varchar, FK to roles)
- permission (varchar)
- resource (varchar)
- action (varchar)
- createdAt (timestamp)

Example rows:
- admin | view_tasks | tasks | read
- admin | create_tasks | tasks | write
- admin | delete_tasks | tasks | write
- worker | view_assigned_tasks | tasks | read
- worker | update_assigned_tasks | tasks | write
- user | view_public_data | dashboard | read
```

**Purpose**: Provides granular permission control for future extensibility

#### New Table: User Role Assignments (Optional)
```
user_role_assignments table:
- id (int, PK)
- userId (int, FK to users)
- roleId (varchar)
- assignedBy (int, FK to users)
- assignedAt (timestamp)
- expiresAt (timestamp, nullable)
- reason (text)
```

**Purpose**: Track role changes and provide audit trail

### 5.2 Backend Implementation

#### Protected Procedure Pattern (Already Exists)
The project already uses `protectedProcedure` from tRPC. We'll extend this with role checks:

```typescript
// Current pattern
protectedProcedure.mutation(({ ctx }) => {
  // User is already authenticated
  // ctx.user contains the user object with role
})

// New pattern with role checking
adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

workerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'worker' && ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

#### API Endpoint Protection Strategy

**Admin-Only Endpoints**:
- `POST /api/trpc/va.create` - Create worker
- `DELETE /api/trpc/va.delete` - Delete worker
- `POST /api/trpc/tasks.bulkComplete` - Bulk operations
- `GET /api/trpc/analytics.full` - Full analytics
- `POST /api/trpc/system.configure` - System settings

**Worker Endpoints** (with data filtering):
- `GET /api/trpc/tasks.list` - Returns only assigned tasks
- `GET /api/trpc/schedule.get` - Returns own schedule only
- `POST /api/trpc/tasks.update` - Update only assigned tasks
- `GET /api/trpc/analytics.personal` - Personal metrics only

**Public/User Endpoints**:
- `GET /api/trpc/auth.me` - Current user info
- `POST /api/trpc/auth.logout` - Logout

#### Data Filtering Logic

```typescript
// In database queries, filter based on role
async function getTasks(userId: number, userRole: string) {
  if (userRole === 'admin') {
    return db.select().from(tasks);  // All tasks
  } else if (userRole === 'worker') {
    return db.select().from(tasks)
      .where(eq(tasks.assignedTo, userId));  // Only assigned
  } else {
    return [];  // User role gets nothing
  }
}
```

### 5.3 Frontend Implementation

#### Route Protection Component

```typescript
// Create a ProtectedRoute component
<ProtectedRoute 
  path="/aptlss" 
  component={APTLSSManagement}
  requiredRole="admin"
  fallback={<AccessDenied />}
/>

<ProtectedRoute 
  path="/settings" 
  component={Settings}
  requiredRole={["admin", "worker"]}
/>
```

#### Conditional Rendering Based on Role

```typescript
const { user } = useAuth();

// Show admin-only features
{user?.role === 'admin' && (
  <Button onClick={handleBulkOperation}>
    Bulk Operations
  </Button>
)}

// Show worker features
{(user?.role === 'admin' || user?.role === 'worker') && (
  <Button onClick={handleReschedule}>
    Reschedule
  </Button>
)}

// Show for all authenticated users
{user && (
  <Button onClick={handleLogout}>
    Logout
  </Button>
)}
```

#### Navigation Menu Customization

```typescript
const getMenuItems = (role: string) => {
  const baseItems = [
    { label: 'Dashboard', path: '/' }
  ];

  if (role === 'admin') {
    return [
      ...baseItems,
      { label: 'APTLSS Management', path: '/aptlss' },
      { label: 'VA Management', path: '/va' },
      { label: 'Analytics', path: '/analytics' },
      { label: 'Settings', path: '/settings' }
    ];
  } else if (role === 'worker') {
    return [
      ...baseItems,
      { label: 'My Tasks', path: '/my-tasks' },
      { label: 'My Schedule', path: '/my-schedule' },
      { label: 'Settings', path: '/settings' }
    ];
  } else {
    return [
      { label: 'Help', path: '/help' },
      { label: 'Request Access', path: '/request-access' }
    ];
  }
};
```

#### Permission Hook

```typescript
// Custom hook for permission checking
function usePermission(requiredRole: string | string[]) {
  const { user } = useAuth();
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return user && roles.includes(user.role);
}

// Usage
function MyComponent() {
  const canManageTasks = usePermission(['admin', 'worker']);
  
  return (
    <>
      {canManageTasks && <TaskManager />}
    </>
  );
}
```

### 5.4 Authentication & Authorization Flow

```
User Login
    ↓
OAuth Callback → User record created/updated with role
    ↓
Session Cookie set (contains user info including role)
    ↓
Frontend requests protected resource
    ↓
Backend checks: Is user authenticated? (session cookie)
    ↓
Backend checks: Does user have required role?
    ↓
If YES → Return data/perform action
If NO → Return 403 Forbidden error
    ↓
Frontend catches error and shows "Access Denied"
```

---

## 6. Implementation Sequence

### Phase 1: Backend Role Enforcement (Week 1)
1. Create `adminProcedure` and `workerProcedure` helpers
2. Wrap all admin endpoints with `adminProcedure`
3. Add data filtering to worker endpoints
4. Test all endpoints with different roles

### Phase 2: Frontend Role-Based UI (Week 2)
1. Create `ProtectedRoute` component
2. Create `usePermission` hook
3. Update navigation menu to show role-specific items
4. Hide/disable buttons based on role
5. Update all pages to respect role permissions

### Phase 3: Worker-Specific Features (Week 3)
1. Create worker dashboard
2. Create "My Tasks" page (filtered to assigned only)
3. Create "My Schedule" page
4. Create personal analytics page
5. Add worker-specific settings

### Phase 4: Admin Management Features (Week 4)
1. Create role management UI
2. Create user assignment interface
3. Create audit log viewer
4. Create system configuration UI
5. Add admin-specific analytics

### Phase 5: Testing & Refinement (Week 5)
1. Test all role transitions
2. Test data isolation between workers
3. Test permission enforcement
4. Security audit
5. Performance testing

---

## 7. Security Considerations

### 7.1 Data Isolation

- **Workers cannot see other workers' tasks**: Database queries must filter by `assignedTo` field
- **Workers cannot see system settings**: Settings page must check role before rendering
- **Workers cannot modify other workers' data**: All mutations must verify ownership

### 7.2 API Security

- **All endpoints must check role**: Use `adminProcedure` or `workerProcedure`
- **No client-side only checks**: Role validation must happen on server
- **Audit all admin actions**: Log who did what and when
- **Rate limiting**: Prevent abuse of bulk operations

### 7.3 Session Security

- **Session cookies are secure**: Already implemented by Manus OAuth
- **Role changes require re-authentication**: User must log out and log back in
- **Expired sessions**: Users lose access automatically

---

## 8. Migration Strategy

### For Existing Users

1. **Current Admin User**: Keep as `admin` role
2. **New Users**: Default to `user` role, can be upgraded to `worker` or `admin`
3. **Batch Assignment**: Admin can assign roles to multiple users at once

### Database Migration

```sql
-- No migration needed! The role column already exists
-- Just need to ensure all users have a role assigned
UPDATE users SET role = 'user' WHERE role IS NULL;
```

---

## 9. Future Enhancements

1. **Custom Roles**: Allow admins to create custom roles with specific permissions
2. **Time-Based Access**: Roles that expire after a certain date
3. **Resource-Based Access**: Control access to specific projects or workspaces
4. **Delegation**: Allow admins to delegate specific permissions to workers
5. **Two-Factor Authentication**: For admin accounts
6. **IP Whitelisting**: Restrict admin access to specific IP addresses

---

## 10. Success Criteria

✅ **Backend**:
- All admin endpoints reject non-admin users
- All worker endpoints filter data by user
- All mutations verify ownership before allowing changes
- Audit logs track all admin actions

✅ **Frontend**:
- Admin sees all features and data
- Workers see only their own data
- Users see limited read-only access
- Navigation menu changes based on role
- Buttons are hidden/disabled appropriately
- No console errors or security warnings

✅ **User Experience**:
- Role transitions are smooth
- Error messages are clear
- Access denied pages are helpful
- Performance is not impacted

---

## Summary

This RBAC implementation will:
- ✅ Leverage existing `role` column in users table
- ✅ Use tRPC's procedure pattern for backend enforcement
- ✅ Implement conditional rendering on frontend
- ✅ Provide complete data isolation between workers
- ✅ Enable admins to manage the system
- ✅ Maintain security and audit trail
- ✅ Scale to support custom roles in the future

**Ready for implementation after approval.**
