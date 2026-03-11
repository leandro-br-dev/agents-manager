# UI Patterns & Design System

This document defines the visual language and component patterns for the agents-manager dashboard. All new UI must follow these patterns to maintain consistency.

## Design Direction

**Industrial / Utilitarian** — precise, information-dense, no decoration for its own sake.

- Background: `#FAFAFA` (near-white)
- Surfaces: `#FFFFFF` with `border-gray-200` borders
- Primary action: `gray-900` (near-black)
- Text hierarchy: `gray-900` / `gray-600` / `gray-400`
- Font: `IBM Plex Sans` (UI) + `IBM Plex Mono` (paths, IDs, code)
- Transitions: `150ms ease` for all interactive states

## Component Reference

All components are in `src/components/` and exported from `src/components/index.ts`.

### PageHeader

Use at the top of every page. Never use raw `<h1>` tags in pages.

```tsx
import { PageHeader } from '@/components'

<PageHeader
  title="Workflows"
  description="Monitor your agent workflows"
  actions={<Button variant="primary">New</Button>}
/>
```

### StatusBadge

Use for all status displays — plans, approvals, environments.

```tsx
import { StatusBadge } from '@/components'

<StatusBadge status="running" animate />  // animate adds pulse on running
<StatusBadge status="success" />
<StatusBadge status="failed" />
```

Supported statuses: `pending` `running` `success` `failed` `timeout` `approved` `denied`

### Button

Never use raw `<button>` with Tailwind classes. Always use the Button component.

```tsx
import { Button } from '@/components'

<Button variant="primary">Create</Button>        // dark bg, white text
<Button variant="secondary">Cancel</Button>      // white bg, gray border
<Button variant="danger">Delete</Button>         // white bg, red border+text
<Button variant="ghost">Edit</Button>            // transparent, gray text

<Button variant="primary" size="sm">Small</Button>
<Button loading={isPending}>Saving...</Button>
<Button disabled>Unavailable</Button>
```

### Card

Use for all content containers.

```tsx
import { Card, CardHeader } from '@/components'

<Card>
  <CardHeader title="Section title" actions={<Button size="sm">Add</Button>} />
  {/* content */}
</Card>

<Card padding="none">  {/* for tables */}
  <table>...</table>
</Card>
```

### ConfirmDialog

Never use `window.confirm()`. Always use ConfirmDialog for destructive actions.

```tsx
import { ConfirmDialog } from '@/components'

const [confirmOpen, setConfirmOpen] = useState(false)

<Button variant="danger" onClick={() => setConfirmOpen(true)}>Delete</Button>

<ConfirmDialog
  open={confirmOpen}
  title="Delete plan?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  onConfirm={() => { deletePlan.mutate(id); setConfirmOpen(false) }}
  onCancel={() => setConfirmOpen(false)}
  loading={deletePlan.isPending}
/>
```

### Input & Select

Always use the Input and Select components for form fields.

```tsx
import { Input, Select } from '@/components'

<Input
  label="Plan name"
  value={name}
  onChange={e => setName(e.target.value)}
  placeholder="My workflow"
  hint="Give it a descriptive name"
  error={errors.name}
  required
/>

<Select
  label="Project"
  value={projectId}
  onChange={e => setProjectId(e.target.value)}
>
  <option value="">Select project...</option>
  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</Select>
```

### EmptyState

Use when a list or section has no items.

```tsx
import { EmptyState } from '@/components'
import { Workflow } from 'lucide-react'

<EmptyState
  icon={<Workflow className="h-12 w-12" />}
  title="No workflows yet"
  description="Create your first workflow to get started"
  action={<Button variant="primary" onClick={...}>New Workflow</Button>}
/>
```

### Pagination

Use for any list with more than 15 items.

```tsx
import { Pagination } from '@/components'

const PAGE_SIZE = 15
const [page, setPage] = useState(1)
const totalPages = Math.ceil(items.length / PAGE_SIZE)
const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

// At the bottom of your table:
<Pagination
  page={page}
  totalPages={totalPages}
  total={items.length}
  pageSize={PAGE_SIZE}
  onPageChange={setPage}
/>
```

### MetricCard

Use in groups of 4 at the top of dashboard-style pages.

```tsx
import { MetricCard } from '@/components'

<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
  <MetricCard label="Total" value={17} />
  <MetricCard label="Success rate" value="23.5%" color="red" />
  <MetricCard label="Avg duration" value="33m" />
  <MetricCard label="Last 7 days" value="4✓ 13✗" />
</div>
```

## Page Layout

Every page must follow this structure:

```tsx
export default function MyPage() {
  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <PageHeader title="..." description="..." actions={...} />
      {/* content */}
    </div>
  )
}
```

## Sidebar Navigation

Order (fixed):
1. Workflows → `/` (LayoutDashboard icon)
2. Projects → `/projects` (FolderOpen icon)
3. Agents → `/agents` (Bot icon)
4. Approvals → `/approvals` (Bell icon) + red count badge when pending
5. Settings → `/settings` (Settings icon)

## Icons

Use only `lucide-react` icons. Common mapping:

| Context | Icon |
|---------|------|
| Create/Add | `Plus` |
| Import | `Upload` |
| Export/Download | `Download` |
| Delete | `Trash2` |
| Edit/Rename | `Pencil` |
| Link | `Link2` |
| Unlink | `Unlink` |
| Agent/Bot | `Bot` |
| Project | `FolderOpen` |
| Environment | `Server` |
| Workflows | `LayoutDashboard` |
| Approvals | `Bell` |
| Settings | `Settings` |
| Running | `Circle` (animated) |
| Stop | `StopCircle` |
| Refresh | `RefreshCw` |

## Typography Rules

- **Page titles**: `text-2xl font-semibold text-gray-900 tracking-tight` (via PageHeader)
- **Section headers**: `text-sm font-semibold text-gray-900`
- **Labels**: `text-xs font-medium text-gray-700`
- **Body**: `text-sm text-gray-600`
- **Meta / timestamps**: `text-xs text-gray-400`
- **Paths / IDs**: `text-xs font-mono text-gray-500`
- **Code blocks**: `bg-gray-900 text-gray-100 rounded p-3 text-xs font-mono`

## Do / Don't

✅ Do:
- Use component library for all UI elements
- Keep page layout consistent: `max-w-6xl mx-auto py-8 px-6`
- Use `text-xs font-mono` for filesystem paths and IDs
- Use `ConfirmDialog` for all destructive actions
- Show loading states with `Button loading={...}`

❌ Don't:
- Use `window.confirm()` or `window.alert()`
- Write inline Tailwind button styles (use Button component)
- Use different spacing patterns per page
- Use fonts other than IBM Plex Sans / IBM Plex Mono
- Add decorative elements (shadows, gradients, rounded-full buttons)
