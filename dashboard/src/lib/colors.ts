/**
 * Centralized Color Configuration
 *
 * This file serves as the single source of truth for all UI colors in the dashboard.
 * All components should import color constants from this file rather than hardcoding
 * color values directly in className strings.
 *
 * **Why use this?**
 * - Ensures consistency across all components
 * - Makes color updates easier (change in one place)
 * - Provides type safety with TypeScript
 * - Documents semantic meaning of colors
 * - Enables automated consistency checking
 *
 * **Usage:**
 * ```tsx
 * import { statusColors, buttonVariants } from '@/lib/colors'
 *
 * <span className={`${statusColors.success.bg} ${statusColors.success.text}`}>
 *   Success!
 * </span>
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Complete color scheme for a status state
 */
export interface StatusColorScheme {
  /** Background color class */
  bg: string
  /** Text color class */
  text: string
  /** Accent/border color class */
  border: string
  /** Solid color for indicators (dots, icons) */
  solid: string
  /** Human-readable label */
  label: string
}

/**
 * Complete color scheme for a button variant
 */
export interface ButtonColorScheme {
  /** Background color class */
  bg: string
  /** Text color class */
  text: string
  /** Border color class */
  border: string
  /** Hover background color class */
  hoverBg: string
  /** Hover text color class */
  hoverText?: string
}

/**
 * Color scheme for neutral/structural elements
 */
export interface NeutralColorScheme {
  /** Primary background color */
  primary: string
  /** Secondary background color */
  secondary: string
  /** Tertiary background color */
  tertiary: string
  /** Dark/inverted background */
  inverted: string
}

/**
 * Interactive state colors
 */
export interface InteractiveStateColors {
  /** Focus ring color */
  focusRing: string
  /** Hover background for subtle interactions */
  hoverBg: string
  /** Disabled state overlay */
  disabled: string
}

// ============================================================================
// STATUS COLORS
// ============================================================================

/**
 * Status badge and indicator colors
 *
 * Used for: Status badges, status indicators, workflow states, plan statuses
 *
 * **Standardization Note:**
 * - Uses 50-shade backgrounds for subtle appearance
 * - Uses 700-shade text for readability (WCAG AA compliant)
 * - Uses 500-shade for solid indicators
 *
 * **Status Meanings:**
 * - `pending`: Not yet started (yellow/gray - still deciding)
 * - `running`: Currently executing (blue - active)
 * - `success`: Completed successfully (green - positive)
 * - `failed`: Completed with errors (red - negative)
 * - `timeout`: Took too long (amber - warning)
 * - `approved`: Explicitly approved (green - positive)
 * - `denied`: Explicitly denied (red - negative)
 */
export const statusColors: Record<string, StatusColorScheme> = {
  /** Waiting to start - uses yellow to indicate "not yet decided" */
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    solid: 'bg-yellow-500',
    label: 'Pending',
  },

  /** Currently executing - uses blue to indicate active state */
  running: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    solid: 'bg-blue-500',
    label: 'Running',
  },

  /** Completed successfully - uses green to indicate positive outcome */
  success: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    solid: 'bg-green-500',
    label: 'Success',
  },

  /** Completed with errors - uses red to indicate negative outcome */
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    solid: 'bg-red-500',
    label: 'Failed',
  },

  /** Exceeded time limit - uses amber to indicate warning */
  timeout: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    solid: 'bg-amber-500',
    label: 'Timeout',
  },

  /** Explicitly approved - shares colors with success */
  approved: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    solid: 'bg-green-500',
    label: 'Approved',
  },

  /** Explicitly denied - shares colors with failed */
  denied: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    solid: 'bg-red-500',
    label: 'Denied',
  },

  /** Fallback for unknown statuses - uses gray to indicate neutral */
  unknown: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
    solid: 'bg-gray-400',
    label: 'Unknown',
  },
} as const

// ============================================================================
// BUTTON COLORS
// ============================================================================

/**
 * Button variant color schemes
 *
 * Used for: Button component, action buttons, form submissions
 *
 * **Variant Meanings:**
 * - `primary`: Main action, draws attention (dark gray/black)
 * - `secondary`: Alternative action, less prominent (white with border)
 * - `danger`: Destructive action, requires caution (red accents)
 * - `ghost`: Minimal action, no background (transparent)
 */
export const buttonVariants: Record<string, ButtonColorScheme> = {
  /** Main call-to-action button - dark gray for strong visual weight */
  primary: {
    bg: 'bg-gray-900',
    text: 'text-white',
    border: 'border-transparent',
    hoverBg: 'hover:bg-gray-800',
  },

  /** Secondary action button - white with border for visual hierarchy */
  secondary: {
    bg: 'bg-white',
    text: 'text-gray-700',
    border: 'border-gray-300',
    hoverBg: 'hover:bg-gray-50',
  },

  /** Destructive action button - red accents to indicate danger */
  danger: {
    bg: 'bg-white',
    text: 'text-red-600',
    border: 'border-red-300',
    hoverBg: 'hover:bg-red-50',
  },

  /** Minimal action button - no background, subtle hover */
  ghost: {
    bg: 'bg-transparent',
    text: 'text-gray-500',
    border: 'border-transparent',
    hoverBg: 'hover:bg-gray-100',
    hoverText: 'hover:text-gray-700',
  },
} as const

// ============================================================================
// METRIC/STAT COLORS
// ============================================================================

/**
 * Metric card and statistic colors
 *
 * Used for: MetricCard component, dashboard statistics, KPIs
 *
 * **Color Meanings:**
 * - `default`: Neutral metric (no trend)
 * -green`: Positive trend/upward movement
 * - `red`: Negative trend/downward movement
 * - `amber`: Warning/caution
 */
export const metricColors: Record<string, { text: string }> = {
  /** Neutral metric - no special meaning */
  default: {
    text: 'text-gray-900',
  },

  /** Positive metric - indicates growth, improvement, or good performance */
  green: {
    text: 'text-green-600',
  },

  /** Negative metric - indicates decline, issues, or poor performance */
  red: {
    text: 'text-red-600',
  },

  /** Warning metric - indicates caution or needs attention */
  amber: {
    text: 'text-amber-600',
  },
} as const

// ============================================================================
// SEMANTIC STATE COLORS
// ============================================================================

/**
 * Error state colors
 *
 * Used for: Error messages, validation errors, failure states
 */
export const errorColors = {
  /** Error text - prominent and readable */
  text: 'text-red-600',
  /** Error text alternative - slightly darker */
  textAlt: 'text-red-700',
  /** Subtle error background */
  bg: 'bg-red-50',
  /** Error border */
  border: 'border-red-300',
  /** Error border - stronger version */
  borderStrong: 'border-red-500',
} as const

/**
 * Success state colors
 *
 * Used for: Success messages, completion states, confirmations
 */
export const successColors = {
  /** Success text - prominent and readable */
  text: 'text-green-600',
  /** Success text alternative - slightly darker */
  textAlt: 'text-green-700',
  /** Subtle success background */
  bg: 'bg-green-50',
  /** Success border */
  border: 'border-green-200',
} as const

/**
 * Warning state colors
 *
 * Used for: Warning messages, caution states, alerts
 *
 * **Note:** Uses amber instead of yellow for better accessibility
 */
export const warningColors = {
  /** Warning text - prominent and readable */
  text: 'text-amber-600',
  /** Warning text alternative - slightly darker */
  textAlt: 'text-amber-700',
  /** Subtle warning background */
  bg: 'bg-amber-50',
  /** Warning border */
  border: 'border-amber-200',
} as const

/**
 * Info state colors
 *
 * Used for: Informational messages, tips, neutral notifications
 */
export const infoColors = {
  /** Info text - blue indicates information */
  text: 'text-blue-600',
  /** Info text alternative - slightly darker */
  textAlt: 'text-blue-700',
  /** Subtle info background */
  bg: 'bg-blue-50',
  /** Info border */
  border: 'border-blue-200',
} as const

// ============================================================================
// NEUTRAL/STRUCTURAL COLORS
// ============================================================================

/**
 * Background colors for structural elements
 *
 * Used for: Layout backgrounds, card backgrounds, section backgrounds
 */
export const bgColors: NeutralColorScheme = {
  /** Primary background - main content area */
  primary: 'bg-white',
  /** Secondary background - cards, panels */
  secondary: 'bg-gray-50',
  /** Tertiary background - nested sections, dividers */
  tertiary: 'bg-gray-100',
  /** Dark/inverted background - dark mode sections, code blocks */
  inverted: 'bg-gray-900',
} as const

/**
 * Text colors for content hierarchy
 *
 * Used for: Headings, body text, captions, labels
 */
export const textColors = {
  /** Primary text - headings, important content */
  primary: 'text-gray-900',
  /** Secondary text - body content, descriptions */
  secondary: 'text-gray-700',
  /** Tertiary text - supporting text, metadata */
  tertiary: 'text-gray-600',
  /** Muted text - captions, placeholders, disabled */
  muted: 'text-gray-500',
  /** Very muted text - timestamps, subtle labels */
  veryMuted: 'text-gray-400',
  /** Inverted text - on dark backgrounds */
  inverted: 'text-white',
} as const

/**
 * Border colors for structural elements
 *
 * Used for: Card borders, input borders, section dividers
 */
export const borderColors = {
  /** Default border - cards, inputs */
  default: 'border-gray-200',
  /** Thick border - emphasis borders */
  thick: 'border-gray-300',
  /** Subtle border - fine dividers */
  subtle: 'border-gray-100',
  /** Strong border - emphasis, sections */
  strong: 'border-gray-500',
  /** Transparent border - spacing, layout */
  transparent: 'border-transparent',
} as const

// ============================================================================
// INTERACTIVE STATE COLORS
// ============================================================================

/**
 * Interactive state colors
 *
 * Used for: Hover states, focus states, disabled states
 */
export const interactiveStates: InteractiveStateColors = {
  /** Focus ring color - keyboard navigation, focused inputs */
  focusRing: 'ring-indigo-500',
  /** Focus ring alternative - for varied hierarchy */
  focusRingAlt: 'ring-blue-500',
  /** Hover background - subtle interaction feedback */
  hoverBg: 'hover:bg-gray-50',
  /** Disabled state - reduced opacity */
  disabled: 'disabled:opacity-50',
} as const

// ============================================================================
// UTILITY COLOR PALETTES
// ============================================================================

/**
 * Complete color palette for reference
 *
 * These are organized by color family for easy reference when designing new components.
 * Try to use the semantic color groups above first, and only use these when needed.
 */
export const colorPalette = {
  /** Gray scale - neutral elements */
  gray: {
    50: 'bg-gray-50 text-gray-50',
    100: 'bg-gray-100 text-gray-100',
    200: 'bg-gray-200 text-gray-200',
    300: 'bg-gray-300 text-gray-300',
    400: 'bg-gray-400 text-gray-400',
    500: 'bg-gray-500 text-gray-500',
    600: 'bg-gray-600 text-gray-600',
    700: 'bg-gray-700 text-gray-700',
    800: 'bg-gray-800 text-gray-800',
    900: 'bg-gray-900 text-gray-900',
  },

  /** Blue scale - info, links, active states */
  blue: {
    50: 'bg-blue-50 text-blue-50',
    100: 'bg-blue-100 text-blue-100',
    200: 'bg-blue-200 text-blue-200',
    300: 'bg-blue-300 text-blue-300',
    400: 'bg-blue-400 text-blue-400',
    500: 'bg-blue-500 text-blue-500',
    600: 'bg-blue-600 text-blue-600',
    700: 'bg-blue-700 text-blue-700',
    800: 'bg-blue-800 text-blue-800',
  },

  /** Green scale - success, positive states */
  green: {
    50: 'bg-green-50 text-green-50',
    100: 'bg-green-100 text-green-100',
    200: 'bg-green-200 text-green-200',
    300: 'bg-green-300 text-green-300',
    400: 'bg-green-400 text-green-400',
    500: 'bg-green-500 text-green-500',
    600: 'bg-green-600 text-green-600',
    700: 'bg-green-700 text-green-700',
    800: 'bg-green-800 text-green-800',
  },

  /** Red scale - errors, negative states */
  red: {
    50: 'bg-red-50 text-red-50',
    100: 'bg-red-100 text-red-100',
    200: 'bg-red-200 text-red-200',
    300: 'bg-red-300 text-red-300',
    400: 'bg-red-400 text-red-400',
    500: 'bg-red-500 text-red-500',
    600: 'bg-red-600 text-red-600',
    700: 'bg-red-700 text-red-700',
    800: 'bg-red-800 text-red-800',
  },

  /** Amber scale - warnings, cautions (preferred over yellow) */
  amber: {
    50: 'bg-amber-50 text-amber-50',
    100: 'bg-amber-100 text-amber-100',
    200: 'bg-amber-200 text-amber-200',
    300: 'bg-amber-300 text-amber-300',
    400: 'bg-amber-400 text-amber-400',
    500: 'bg-amber-500 text-amber-500',
    600: 'bg-amber-600 text-amber-600',
    700: 'bg-amber-700 text-amber-700',
    800: 'bg-amber-800 text-amber-800',
  },

  /** Yellow scale - alternative warnings (use amber when possible) */
  yellow: {
    50: 'bg-yellow-50 text-yellow-50',
    100: 'bg-yellow-100 text-yellow-100',
    200: 'bg-yellow-200 text-yellow-200',
    300: 'bg-yellow-300 text-yellow-300',
    400: 'bg-yellow-400 text-yellow-400',
    500: 'bg-yellow-500 text-yellow-500',
    600: 'bg-yellow-600 text-yellow-600',
    700: 'bg-yellow-700 text-yellow-700',
    800: 'bg-yellow-800 text-yellow-800',
  },
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Union type of all available status keys
 */
export type StatusKey = keyof typeof statusColors

/**
 * Union type of all available button variant keys
 */
export type ButtonVariant = keyof typeof buttonVariants

/**
 * Union type of all available metric color keys
 */
export type MetricColor = keyof typeof metricColors
