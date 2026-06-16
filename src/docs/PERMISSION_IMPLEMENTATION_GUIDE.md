# Permission System Implementation Guide

## Quick Start

### 1. Setup - Wrap Your App with Provider

```typescript
// src/main.tsx or src/App.tsx
import { PermissionProvider } from "@/contexts/PermissionContext";
import { BrowserRouter } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <PermissionProvider>
        {/* Your app routes */}
        <Routes>
          {/* ... */}
        </Routes>
      </PermissionProvider>
    </BrowserRouter>
  );
}

export default App;
```

### 2. Use in Components

```typescript
import { usePermission } from "@/contexts/PermissionContext";

export function MyComponent() {
  const { hasPermission, isLoading } = usePermission();

  if (isLoading) return <div>Loading...</div>;

  if (!hasPermission("users", "user-list", "view")) {
    return <div>Access Denied</div>;
  }

  return (
    <div>
      {hasPermission("users", "user-list", "add") && (
        <button>Add User</button>
      )}
      {/* Component content */}
    </div>
  );
}
```

---

## Permission Levels & Actions

### Standard Actions

| Action | Meaning | Example |
|--------|---------|---------|
| `view` | Read/View access | See list, view details |
| `add` | Create new records | Create user, add customer |
| `edit` | Modify existing records | Update profile, change status |
| `delete` | Remove records | Delete user, remove item |

### API Response Example

```json
{
  "permissions": {
    "users": {
      "user-list": ["view", "add", "edit"],
      "user-detail": ["view", "edit", "delete"],
      "user-roles": ["view"]
    },
    "customers": {
      "customer-list": ["view", "add"],
      "customer-edit": ["view", "edit", "delete"]
    },
    "reports": {
      "reports": ["view"]
    }
  },
  "timestamp": "2024-03-20T10:30:00Z",
  "version": 1
}
```

---

## Common Patterns

### Pattern 1: Simple Permission Check

```typescript
const { hasPermission } = usePermission();

if (hasPermission("users", "user-list", "add")) {
  // Show add button
}
```

### Pattern 2: Module-Level Access Control

```typescript
import { useModulePermissions } from "@/hooks/usePermissionHelpers";

const permissions = useModulePermissions("users");

if (!permissions.hasAnyPermission) {
  return <AccessDenied />;
}

return (
  <div>
    {permissions.canAdd && <AddButton />}
    {permissions.canEdit && <EditButton />}
    {permissions.canDelete && <DeleteButton />}
  </div>
);
```

### Pattern 3: Conditional Rendering with Fallback

```typescript
import { PermissionGate } from "@/hooks/usePermissionHelpers";

<PermissionGate
  moduleName="users"
  screenName="user-list"
  action="edit"
  fallback={<span className="text-gray-400">Not editable</span>}
>
  <EditButton />
</PermissionGate>
```

### Pattern 4: Dynamic Menu/Sidebar

```typescript
const menuItems = [
  { id: "dashboard", label: "Dashboard", module: "dashboard" },
  { id: "users", label: "Users", module: "users" },
  { id: "reports", label: "Reports", module: "reports" },
];

export function Navigation() {
  const { hasPermission } = usePermission();

  return (
    <nav>
      {menuItems
        .filter((item) =>
          item.module === "dashboard" ||
          hasPermission(item.module, item.id, "view")
        )
        .map((item) => (
          <NavLink key={item.id} to={item.path}>
            {item.label}
          </NavLink>
        ))}
    </nav>
  );
}
```

### Pattern 5: Form Validation

```typescript
export function SaveUserForm({ user }) {
  const { hasPermission } = usePermission();
  const canSave = hasPermission("users", "user-edit", "edit");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!canSave) {
      alert("You don't have permission to edit this user");
      return;
    }
    
    // Save user
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {canSave && <button type="submit">Save</button>}
    </form>
  );
}
```

---

## Polling & Updates

### Automatic Polling

The system automatically polls for permission updates every **10 seconds** for non-superadmin users.

```typescript
// Timeline:
// 0s    → App mount, initial permission fetch
// 10s   → First poll
// 20s   → Second poll (if component still mounted)
// 30s   → Third poll
// ...   → Continues until component unmounts
// Unmount → Polling stops, memory cleared
```

### Manual Update

To manually trigger a permission refresh (e.g., after role change):

```typescript
const { updatePermissions } = usePermission();

// After user role changes
const newPermissions = await fetchFreshPermissions();
updatePermissions(newPermissions);
```

### Disable Polling for Superadmin

```typescript
// Automatic behavior:
// - Superadmin users: Polling DISABLED (no API calls)
// - Regular users: Polling ENABLED (10s interval)

const role = localStorage.getItem("user_role");
// If role === "superadmin" or "super_admin" → No polling
// Otherwise → Polling enabled
```

---

## Optimization & Performance

### Memory Efficiency

```typescript
// ✅ Good: Component unmounts, cleanup runs
useEffect(() => {
  return () => {
    clearInterval(pollingInterval);
    isMounted.current = false;
  };
}, []);
```

### Avoid Redundant Checks

```typescript
// ❌ Bad: Checks permission on every render
export function Component() {
  const { hasPermission } = usePermission();
  
  return (
    <div>
      {hasPermission("users", "list", "add") && <AddBtn />}
      {hasPermission("users", "list", "edit") && <EditBtn />}
      {hasPermission("users", "list", "delete") && <DeleteBtn />}
    </div>
  );
}

// ✅ Good: Extract to custom hook
export function Component() {
  const perms = useModulePermissions("users");
  
  return (
    <div>
      {perms.canAdd && <AddBtn />}
      {perms.canEdit && <EditBtn />}
      {perms.canDelete && <DeleteBtn />}
    </div>
  );
}
```

### Memoization

```typescript
import { useMemo } from "react";
import { usePermission } from "@/contexts/PermissionContext";

export function Component() {
  const { hasPermission } = usePermission();

  // Memoize computed permissions
  const permissions = useMemo(
    () => ({
      canEdit: hasPermission("items", "item", "edit"),
      canDelete: hasPermission("items", "item", "delete"),
    }),
    [hasPermission]
  );

  return (
    <div>
      {permissions.canEdit && <EditBtn />}
      {permissions.canDelete && <DeleteBtn />}
    </div>
  );
}
```

---

## Testing

### Mock usePermission Hook

```typescript
import { vi } from "vitest";
import { usePermission } from "@/contexts/PermissionContext";

// Mock the hook
vi.mock("@/contexts/PermissionContext", () => ({
  usePermission: vi.fn(() => ({
    hasPermission: vi.fn((module, screen, action) => {
      // Return true for specific scenarios
      if (module === "users" && action === "view") return true;
      if (module === "admin" && action === "delete") return false;
      return false;
    }),
    isLoading: false,
    permissions: {},
    lastVersion: 1,
  })),
}));

describe("MyComponent", () => {
  it("shows edit button when user has permission", () => {
    render(<MyComponent />);
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("hides delete button when user lacks permission", () => {
    render(<MyComponent />);
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });
});
```

---

## Debugging

### Enable Detailed Logging

The system logs detailed information to the console. Check for:

```
[PermissionContext] 🔐 SuperAdmin detected
[PermissionContext] 📡 Initial fetch for role: admin
[PermissionContext] ⏱️ Starting permission polling (10s interval)
[PermissionContext] 🔄 Polling permissions...
[PermissionContext] ✅ Permissions updated from API
[Permissions API] 📡 Fetching from: https://api.example.com/login/my-permissions/
```

### Check Current Permissions

```typescript
export function DebugPanel() {
  const { permissions, lastVersion, isLoading } = usePermission();

  return (
    <div style={{ padding: "20px", border: "1px solid red" }}>
      <h3>Permission Debug Info</h3>
      <p>Loading: {String(isLoading)}</p>
      <p>Version: {lastVersion}</p>
      <pre>{JSON.stringify(permissions, null, 2)}</pre>
    </div>
  );
}
```

### Verify Token

```typescript
// Check if access token is present
const token = localStorage.getItem("access_token");
if (!token) {
  console.warn("No access token found - API calls will fail");
}

// Check if user role is set
const role = localStorage.getItem("user_role");
console.log("Current role:", role);
```

---

## Troubleshooting

### Problem: Permissions not loading

**Checklist:**
1. ✅ Is `access_token` in localStorage?
2. ✅ Is API URL configured (`VITE_API_LOCAL` or `VITE_API_PROD`)?
3. ✅ Is token valid (not expired)?
4. ✅ Check browser console for errors

```typescript
// Verify in console:
console.log(localStorage.getItem("access_token")); // Should exist
console.log(import.meta.env.VITE_API_LOCAL);      // Should be set
```

### Problem: Polling uses too much bandwidth

**Solution:** Adjust polling interval in PermissionContext

```typescript
// Current: 10 seconds
// To change to 30 seconds:
pollingIntervalRef.current = setInterval(() => {
  fetchAndUpdatePermissions();
}, 30000); // 30 seconds instead of 10
```

### Problem: SuperAdmin isn't seeing all modules

**Check role format:**

```typescript
const role = localStorage.getItem("user_role");
if (role !== "superadmin" && role !== "super_admin") {
  console.warn("Role might not be superadmin:", role);
}
```

### Problem: Permission check always returns false

**Possible causes:**
1. Module/screen name mismatch (case sensitivity)
2. API not returning permissions
3. Token expired
4. Permissions not yet loaded (check `isLoading`)

```typescript
// Debug permission check:
const { hasPermission, isLoading, permissions } = usePermission();

if (isLoading) {
  console.log("Permissions still loading...");
}

console.log("Available modules:", Object.keys(permissions));
const result = hasPermission("users", "user-list", "view");
console.log("Permission result:", result);
```

---

## API Contract

### Request

```
GET /api/v1/login/my-permissions/
Authorization: Bearer {access_token}
```

### Response (Success - 200 OK)

```json
{
  "permissions": {
    "module_name": {
      "screen_name": ["view", "add", "edit", "delete"]
    }
  },
  "timestamp": "2024-03-20T10:30:00Z",
  "version": 1
}
```

### Response (Error - 401 Unauthorized)

```json
{
  "detail": "Token expired or invalid"
}
```

**Fallback behavior:** Errors revert to stored permissions (localStorage)

---

## Best Practices

### ✅ DO

- Use `usePermission()` hook in components
- Create custom hooks for DRY permission checks
- Memoize permission checks when checking multiple
- Hide UI elements (prefer over disabling)
- Check permissions on the backend too
- Clear permissions on logout

### ❌ DON'T

- Don't hardcode role names
- Don't store permissions only in localStorage
- Don't skip permission checks trusting frontend
- Don't make permission checks in render (use hooks)
- Don't forget cleanup in useEffect

---

## Migration from Other Systems

### Converting from localStorage-only system

**Before:**
```typescript
const permissions = JSON.parse(localStorage.getItem("permissions"));
const canEdit = permissions?.users?.edit === true;
```

**After:**
```typescript
const { hasPermission } = usePermission();
const canEdit = hasPermission("users", "user-list", "edit");
```

### Converting from Redux permissions state

**Before:**
```typescript
const permissions = useSelector(state => state.permissions);
```

**After:**
```typescript
const { permissions } = usePermission();
```

---

## File Structure

```
src/
├── contexts/
│   └── PermissionContext.tsx          # Main context provider
├── utils/
│   └── permissions.ts                 # Utility functions
├── hooks/
│   └── usePermissionHelpers.ts        # Custom permission hooks
├── components/
│   ├── ProtectedRoute.tsx             # Route protection
│   └── examples/
│       └── PermissionExamples.tsx     # Example components
└── docs/
    └── PERMISSION_SYSTEM.md           # Full documentation
```

---

## Summary Table

| Task | Solution |
|------|----------|
| Basic permission check | `hasPermission("module", "screen", "action")` |
| Multiple permissions | `useModulePermissions("module")` |
| Hide elements | Use conditional rendering |
| Protect routes | Wrap in `<ProtectedRoute>` |
| Toggle polling | Automatic (10s for non-superadmin) |
| Manual refresh | `updatePermissions(newPerms)` |
| Custom logic | Create hook using `usePermission()` |
| Testing | Mock `usePermission` hook |
| Debugging | Check browser console logs |
