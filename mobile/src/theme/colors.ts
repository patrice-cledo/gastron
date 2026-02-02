/**
 * Color palette inspired by the Gastrons design (green-focused, food app)
 * Primary dark green, bright lime for CTAs, white backgrounds, dark charcoal text.
 */

export const colors = {
  // Primary palette (green family)
  primaryDark: '#1A5B3D',      // Deep forest green - nav bar, headers, headings
  accent: '#CEEC2C',           // Bright lime - main CTAs, selected tab, highlights
  gastronButton: '#E0EB60',    // Lime green - "Ask your Gastron" / Start New Order style
  linkGreen: '#347A22',        // Medium green - links
  buttonSecondary: '#697E55', // Muted olive green - secondary buttons (e.g. Sign Up)

  // Neutrals & backgrounds
  white: '#FFFFFF',
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
  parchment: '#F5F5F0',       // Off-white for subtle sections
  beige: '#E8E8E0',
  lightGray: '#D4D4CE',
  warmGray: '#B8B8B0',

  // Text colors
  black: '#1E293B',           // Dark charcoal - primary body text
  darkGray: '#4A4A4A',
  mediumGray: '#6B6B6B',
  lightText: '#8A8A8A',

  // Legacy / aliases (kept for compatibility)
  accentGreen: '#8B9A7A',
  accentBrown: '#9B8B7A',

  // Status & semantic
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F97316',
  info: '#7A8B9B',

  // Promo / food accents (used sparingly)
  foodRed: '#EF4444',
  foodOrange: '#FF6B00',
  foodGreen: '#347A22',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F0F0EA',
} as const;

export type ColorKey = keyof typeof colors;
