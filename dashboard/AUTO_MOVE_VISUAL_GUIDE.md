# Auto-Move Toggle - Visual Guide

## What You'll See

### Location
The auto-move toggle appears in the **Kanban Board page header**, positioned to the left of the project filter dropdown.

### Visual Appearance

**When Disabled (Default):**
```
┌─────────────────────────────────────────────┐
│  ⚡ Auto-move    ◯───                         │  ← Gray icon, toggle off
└─────────────────────────────────────────────┘
```

**When Enabled:**
```
┌─────────────────────────────────────────────┐
│  ⚡ Auto-move    ───◯                         │  ← Yellow icon, toggle on
└─────────────────────────────────────────────┘
```

## How to Use

### Step 1: Open Kanban Board
Navigate to the Kanban Board page from the main navigation.

### Step 2: Select a Project
Choose a project from the dropdown filter (or if you only have one project, it will be automatically selected).

### Step 3: Toggle Auto-Move
- Click the toggle switch to enable/disable auto-move
- The ⚡ icon turns yellow when enabled
- The toggle slides to the right when enabled
- Your preference is immediately saved to project settings

### Step 4: Verify
- Refresh the page to confirm your preference persists
- The toggle should remain in the same state
- The project settings are updated in the database

## Component Details

### Container
- **Style:** White background with gray border
- **Padding:** px-3 py-1.5 (12px horizontal, 6px vertical)
- **Radius:** rounded-md (4px border-radius)
- **Layout:** Flexbox with items centered

### Icon (⚡ Zap)
- **Size:** h-4 w-4 (16px × 16px)
- **Color:**
  - `text-gray-400` when disabled
  - `text-yellow-500` when enabled

### Label
- **Text:** "Auto-move"
- **Size:** text-sm (14px)
- **Color:** text-gray-700

### Switch Component
- **Size:** h-5 w-9 (20px × 36px)
- **Track Color:**
  - `bg-gray-300` when disabled
  - `bg-gray-900` when enabled
- **Thumb:** White circle (16px × 16px)
- **Animation:** Smooth slide transition
- **States:**
  - Normal: Hover effect
  - Focus: Visible focus ring
  - Disabled: Reduced opacity, no cursor

## Accessibility Features

✅ **Keyboard Navigation:** Tab to focus, Space/Enter to toggle
✅ **ARIA Attributes:** Proper role="switch" and aria-checked
✅ **Focus Indicator:** Visible focus ring for keyboard users
✅ **Screen Reader:** Announces state changes to screen readers
✅ **Touch Targets:** Adequate size for touch interactions (36px height)

## Responsive Design

The toggle container works well on:
- **Desktop:** Appears alongside other header actions
- **Tablet:** Maintains proper spacing and sizing
- **Mobile:** May wrap to new line if header is too narrow

## Integration Points

### State Management
- Reads from: `project.settings.auto_move_enabled`
- Writes to: Project settings via `useUpdateProject` mutation
- Triggers: Refresh of Kanban data after update

### Visual Feedback
- **Immediate:** Toggle changes position instantly
- **Icon:** Zap icon color changes to indicate state
- **Loading:** Toggle disabled during API call

### Error Handling
- Gracefully handles missing project settings (defaults to false)
- Prevents concurrent updates (disables during mutation)
- Maintains existing settings (auto_approve_workflows)
