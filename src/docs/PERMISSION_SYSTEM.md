# Permission System Documentation

## Overview

The permission system provides role-based access control with automatic polling for permission updates. It supports:

- ✅ **API-driven permissions** - Fetches from `GET /api/v1/login/my-permissions/`
- ✅ **SuperAdmin bypass** - Full access without API calls
- ✅ **Auto-polling** - Updates every 10 seconds for non-superadmin users
- ✅ **Version-based optimization** - Skips unnecessary state updates
- ✅ **Performance optimized** - Memoization, proper cleanup, no localStorage state
- ✅ **Multi-tab sync** - Storage events for cross-tab synchronization

---

## Architecture

### 1. **PermissionContext** (`src/contexts/PermissionContext.tsx`)
- Central state manager for permissions
- Handles API fetching with polling
- Provides `usePermission()` hook

### 2. **Utilities** (`src/utils/permissions.ts`)
- `fetchPermissionsFromAPI()` - API call with Bearer token
- `hasPermission()` - Flexible permission checking with aliases
- `sanitizePermissions()` - Safe data normalization

### 3. **ProtectedRoute** (`src/components/ProtectedRoute.tsx`)
- Route-level access control
- Token validation and expiry checking
- Role-based route restrictions

---

## Core API

### usePermission Hook

```typescript
import { usePermission } from "@/contexts/PermissionContext";

const MyComponent = () => {
  const { 
    permissions,      // Raw permission object
    hasPermission,    // Function to check access
    isLoading,        // Loading state during API fetch
    lastVersion       // Version of current permissions
  } = usePermission();

  return <div>{/* ... */}</div>;
};
```

### hasPermission Function

```typescript
// Context method
const allowed = hasPermission(moduleName, screenName, action);

// Utility function
import { hasPermission } from "@/utils/permissions";
const allowed = hasPermission("Users", "Create", "add", permissions);
```

**Parameters:**
- `moduleName` (string) - Module/feature name (e.g., "users", "customers")
- `screenName` (string) - Screen/page name (e.g., "create-user", "user-list")
- `action` (string, default: "view") - Action type: "view", "add", "edit", "delete"

**Features:**
- ✅ Case-insensitive matching
- ✅ Handles singular/plural forms (e.g., "user" ↔ "users")
- ✅ Module aliases (e.g., "customer-master" ↔ "customers")
- ✅ Action aliases (e.g., "create" ↔ "add")

---

## Examples

### Example 1: Conditional Button Rendering

```typescript
import { usePermission } from "@/contexts/PermissionContext";
import { Button } from "@/components/ui/button";

export function UserListActions() {
  const { hasPermission } = usePermission();

  return (
    <div className="flex gap-2">
      {/* Show Edit button only if user has "edit" permission */}
      {hasPermission("users", "user-list", "edit") && (
        <Button onClick={() => handleEdit()}>
          Edit User
        </Button>
      )}

      {/* Show Delete button only if user has "delete" permission */}
      {hasPermission("users", "user-list", "delete") && (
        <Button variant="destructive" onClick={() => handleDelete()}>
          Delete User
        </Button>
      )}

      {/* Show Add button only if user has "add" permission */}
      {hasPermission("users", "user-list", "add") && (
        <Button onClick={() => handleCreate()}>
          Add New User
        </Button>
      )}
    </div>
  );
}
```

### Example 2: Protected Route

```typescript
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UserList } from "@/pages/UserList";

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
            <UserList />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

### Example 3: Permission-Based Module Visibility

```typescript
import { usePermission } from "@/contexts/PermissionContext";
import { Dashboard } from "@/pages/Dashboard";
import { Users } from "@/pages/Users";
import { Reports } from "@/pages/Reports";

export function AdminPanel() {
  const { hasPermission } = usePermission();

  // Only show modules that the user has permission for
  const modules = [
    {
      id: "dashboard",
      label: "Dashboard",
      component: Dashboard,
      visible: true, // Always visible
    },
    {
      id: "users",
      label: "User Management",
      component: Users,
      visible: hasPermission("user-management", "users", "view"),
    },
    {
      id: "reports",
      label: "Reports",
      component: Reports,
      visible: hasPermission("reporting", "reports", "view"),
    },
  ];

  return (
    <nav>
      {modules
        .filter(m => m.visible)
        .map(m => (
          <NavLink key={m.id} to={`/admin/${m.id}`}>
            {m.label}
          </NavLink>
        ))}
    </nav>
  );
}
```

### Example 4: Data Table with Conditional Actions

```typescript
import { usePermission } from "@/contexts/PermissionContext";
import { Table } from "@/components/ui/table";

export function CustomerTable({ data }) {
  const { hasPermission } = usePermission();

  const columns = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    // Only add action column if user has edit or delete permissions
    ...(hasPermission("customers", "customer-list", "edit") ||
      hasPermission("customers", "customer-list", "delete")
      ? [{
          header: "Actions",
          cell: (row) => (
            <div className="flex gap-2">
              {hasPermission("customers", "customer-list", "edit") && (
                <Button size="sm" onClick={() => editCustomer(row.id)}>
                  Edit
                </Button>
              )}
              {hasPermission("customers", "customer-list", "delete") && (
                <Button size="sm" variant="destructive" onClick={() => deleteCustomer(row.id)}>
                  Delete
                </Button>
              )}
            </div>
          ),
        }]
      : []),
  ];

  return <Table columns={columns} data={data} />;
}
```

### Example 5: Form Field Conditional Disabling

```typescript
import { usePermission } from "@/contexts/PermissionContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EditUserForm({ user }) {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission("users", "edit-user", "edit");
  const canChangeRole = hasPermission("users", "edit-user", "edit") &&
                        hasPermission("role-assigns", "user-roles", "edit");

  return (
    <form>
      <Input
        label="Name"
        defaultValue={user.name}
        disabled={!canEdit}
      />
      
      <Select
        label="Role"
        defaultValue={user.role}
        disabled={!canChangeRole}
      />

      {canEdit && (
        <Button type="submit">Save Changes</Button>
      )}
    </form>
  );
}
```

### Example 6: Custom Hook for Module Access

```typescript
import { usePermission } from "@/contexts/PermissionContext";

/**
 * Custom hook to check all permissions for a module
 */
export function useModulePermissions(moduleName: string) {
  const { hasPermission } = usePermission();

  return {
    canView: hasPermission(moduleName, moduleName, "view"),
    canAdd: hasPermission(moduleName, moduleName, "add"),
    canEdit: hasPermission(moduleName, moduleName, "edit"),
    canDelete: hasPermission(moduleName, moduleName, "delete"),
    
    // Utility: Check if user has ANY permission in module
    hasAnyPermission: () => [
      hasPermission(moduleName, moduleName, "view"),
      hasPermission(moduleName, moduleName, "add"),
      hasPermission(moduleName, moduleName, "edit"),
      hasPermission(moduleName, moduleName, "delete"),
    ].some(Boolean),
  };
}

// Usage
export function CustomersPage() {
  const permissions = useModulePermissions("customers");

  if (!permissions.hasAnyPermission()) {
    return <AccessDenied />;
  }

  return (
    <div>
      {permissions.canAdd && <NewCustomerButton />}
      {permissions.canView && <CustomerList />}
    </div>
  );
}
```

---

## Permission Polling

The system automatically polls for permission updates every 10 seconds (for non-superadmin users):

```typescript
// Polling is automatic via PermissionContext
// For superadmins: polling is DISABLED (no API calls)
// For regular users: polls every 10 seconds with version optimization

// To manually trigger an update:
const { updatePermissions } = usePermission();
updatePermissions(newPermissionsObject);
```

**Polling Flow:**
1. Component mounts → Initial fetch on app load
2. After 10 seconds → Automatic poll
3. Version check → Skip update if same version
4. Component unmounts → Polling stops, cleanup runs

---

## API Response Format

```typescript
// GET /api/v1/login/my-permissions/
{
  "permissions": {
    "Module": {
      "Screen": ["view", "add", "edit", "delete"]
    }
  },
  "timestamp": "2024-03-20T10:30:00Z",
  "version": 1
}
```

---

## Implementation Details

### Memoization & Performance

- ✅ `useCallback` for stable function references
- ✅ `useMemo` for expensive computations
- ✅ `useRef` for non-state values (polling interval, mounted flag)
- ✅ Cleanup functions prevent memory leaks
- ✅ Version checking prevents unnecessary state updates

### Cleanup & Unmount

```typescript
// Automatic cleanup when component unmounts:
useEffect(() => {
  return () => {
    isMountedRef.current = false;      // Flag to prevent state updates
    clearInterval(pollingIntervalRef.current);  // Stop polling
  };
}, []);
```

### Error Handling

- API failures fall back to localStorage
- Missing permissions default to false (deny by default)
- Invalid roles treated as non-superadmin
- Network errors logged but don't crash the app

---

## Troubleshooting

### Permissions not loading?

```typescript
// Check browser console for:
// ✅ [PermissionContext] 📡 Fetching permissions from API...
// ✅ [PermissionContext] ✅ Permissions updated from API

// If you see:
// ❌ [Permissions API] No access token found
// → Check localStorage.access_token is present

// ❌ [Permissions API] HTTP 401
// → Token is expired or invalid. Re-login required.
```

### SuperAdmin not seeing everything?

```typescript
// Check:
const role = localStorage.getItem("user_role");
console.log("Current role:", role);
// Should be "superadmin" or "super_admin"

// SuperAdmin check:
const { hasPermission } = usePermission();
hasPermission("any-module", "any-screen", "view"); // Should return true
```

### Polling using too much bandwidth?

```typescript
// Current: 10-second interval
// To change, edit PermissionContext.tsx:
pollingIntervalRef.current = setInterval(() => {
  fetchAndUpdatePermissions();
}, 30000); // Change to 30 seconds
```

---

## Best Practices

1. **Always use the hook** - Don't parse permissions manually
2. **Check before rendering** - Hide UI elements, don't show and disable
3. **SuperAdmin mode** - Remember superadmin bypasses all checks
4. **Error handling** - Default to deny (return false on missing permissions)
5. **Performance** - Avoid checking same permission multiple times in a component
6. **Custom hooks** - Create module-specific hooks for reusability
7. **Testing** - Mock `usePermission` in tests

---

## Type Definitions

```typescript
type PermissionAction = "view" | "add" | "edit" | "delete" | string;

type PermissionsMap = Record<string, Record<string, string[]>>;
// Example:
// {
//   "users": {
//     "user-list": ["view", "add", "edit"],
//     "user-detail": ["view", "edit", "delete"]
//   }
// }

type PermissionContextValue = {
  permissions: PermissionsMap;
  hasPermission: (moduleName: string, screenName: string, action?: PermissionAction) => boolean;
  updatePermissions: (permissions: PermissionsMap) => void;
  isLoading: boolean;
  lastVersion: number | null;
};
```

---

## Related Files

- [`src/contexts/PermissionContext.tsx`](../contexts/PermissionContext.tsx) - Main context
- [`src/utils/permissions.ts`](../utils/permissions.ts) - Utility functions
- [`src/components/ProtectedRoute.tsx`](../components/ProtectedRoute.tsx) - Route protection
- [`src/types/roles.ts`](../types/roles.ts) - Role type definitions
