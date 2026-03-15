# Color Fixes - Quick Action Guide

## Files That Need Updates

### 1. Create New Configuration Files

#### `src/config/statusColors.ts` (NEW FILE)
```typescript
export const STATUS_COLORS = {
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-500',
  },
  running: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
  },
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
  },
  timeout: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  approved: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
  },
  denied: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
  },
} as const;

export type StatusType = keyof typeof STATUS_COLORS;
```

### 2. Update Existing Files

#### `src/components/StatusBadge.tsx`
**Replace lines 1-9:**
```typescript
// BEFORE
const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:  { bg: 'bg-gray-100',   text: 'text-gray-600',  dot: 'bg-gray-400',  label: 'Pending' },
  running:  { bg: 'bg-blue-50',    text: 'text-blue-700',  dot: 'bg-blue-500',  label: 'Running' },
  success:  { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500', label: 'Success' },
  failed:   { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500',   label: 'Failed' },
  timeout:  { bg: 'bg-amber-50',   text: 'text-amber-700', dot: 'bg-amber-500', label: 'Timeout' },
  approved: { bg: 'bg-green-50',   text: 'text-green-700', dot: 'bg-green-500', label: 'Approved' },
  denied:   { bg: 'bg-red-50',     text: 'text-red-700',   dot: 'bg-red-500',   label: 'Denied' },
};

// AFTER
import { STATUS_COLORS } from '@/config/statusColors';

const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:  { bg: STATUS_COLORS.pending.bg,   text: STATUS_COLORS.pending.text,  dot: STATUS_COLORS.pending.dot,  label: 'Pending' },
  running:  { bg: STATUS_COLORS.running.bg,   text: STATUS_COLORS.running.text,  dot: STATUS_COLORS.running.dot,  label: 'Running' },
  success:  { bg: STATUS_COLORS.success.bg,   text: STATUS_COLORS.success.text,  dot: STATUS_COLORS.success.dot,  label: 'Success' },
  failed:   { bg: STATUS_COLORS.failed.bg,    text: STATUS_COLORS.failed.text,   dot: STATUS_COLORS.failed.dot,   label: 'Failed' },
  timeout:  { bg: STATUS_COLORS.timeout.bg,   text: STATUS_COLORS.timeout.text,  dot: STATUS_COLORS.timeout.dot,  label: 'Timeout' },
  approved: { bg: STATUS_COLORS.approved.bg,  text: STATUS_COLORS.approved.text, dot: STATUS_COLORS.approved.dot, label: 'Approved' },
  denied:   { bg: STATUS_COLORS.denied.bg,    text: STATUS_COLORS.denied.text,   dot: STATUS_COLORS.denied.dot,   label: 'Denied' },
};
```

#### `src/features/plans/components/PlanDetail.tsx`
**Replace lines 11-16:**
```typescript
// BEFORE
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// AFTER
import { STATUS_COLORS } from '@/config/statusColors';

const statusColors = {
  pending: STATUS_COLORS.pending.badge,
  running: STATUS_COLORS.running.badge,
  success: STATUS_COLORS.success.badge,
  failed: STATUS_COLORS.failed.badge,
};
```

#### `src/features/plans/components/PlansList.tsx`
**Replace lines 8-13:**
```typescript
// BEFORE
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

// AFTER
import { STATUS_COLORS } from '@/config/statusColors';

const statusColors: Record<string, string> = {
  pending: STATUS_COLORS.pending.badge,
  running: STATUS_COLORS.running.badge,
  success: STATUS_COLORS.success.badge,
  failed: STATUS_COLORS.failed.badge,
};
```

### 3. Update CSS File

#### `src/App.css`
**Replace lines 15, 18, and 41:**
```css
/* BEFORE */
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

/* ... */

.read-the-docs {
  color: #888;
}

/* AFTER */
.logo:hover {
  filter: drop-shadow(0 0 0.5em rgba(99, 102, 241, 0.5)); /* indigo-500 with opacity */
}
.logo.react:hover {
  filter: drop-shadow(0 0 0.5em rgba(14, 165, 233, 0.5)); /* sky-500 with opacity */
}

/* ... */

.read-the-docs {
  color: rgb(156, 163, 175); /* gray-400 */
}
```

### 4. Update Test Files

#### `src/features/plans/components/PlansList.test.tsx`
**Update expected color classes in tests (lines 85-86):**
```typescript
// BEFORE
expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
expect(runningBadge).toHaveClass('bg-blue-100', 'text-blue-800');

// AFTER (unchanged, but verify they match STATUS_COLORS)
expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
expect(runningBadge).toHaveClass('bg-blue-100', 'text-blue-800');
```

## Checklist

- [ ] Create `src/config/statusColors.ts`
- [ ] Update `src/components/StatusBadge.tsx`
- [ ] Update `src/features/plans/components/PlanDetail.tsx`
- [ ] Update `src/features/plans/components/PlansList.tsx`
- [ ] Update `src/App.css` (hex colors)
- [ ] Run tests to verify no regressions
- [ ] Visual check of status badges across the app

## Testing After Changes

1. **Check Status Badges:**
   - Visit Agents page
   - Visit Plans page
   - Visit Plan Detail page
   - Verify all status badges look consistent

2. **Check Colors:**
   - Verify logo hover effects still work
   - Verify error states still show correctly
   - Verify success states still show correctly

3. **Run Tests:**
   ```bash
   npm test
   ```

## Optional Future Improvements

1. **Create a StatusBadge variant system:**
   ```typescript
   <StatusBadge status="pending" variant="light" />  // bg-50 text-700
   <StatusBadge status="pending" variant="badge" />  // bg-100 text-800
   <StatusBadge status="pending" variant="solid" />  // bg-500 text-white
   ```

2. **Add CSS custom properties for theme colors:**
   ```css
   :root {
     --color-status-pending-bg: theme('colors.yellow.50');
     --color-status-pending-text: theme('colors.yellow.700');
     /* ... */
   }
   ```

3. **Consider removing unused color families:**
   - Pink, Orange, Teal, Cyan, Emerald are rarely used
   - Consider removing if not in design system

---

**Total Estimated Time:** 1-2 hours
**Risk Level:** Low (isolated changes)
**Testing Required:** Visual + unit tests
