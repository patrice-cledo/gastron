/**
 * Color palette based on Gastrons design guidelines
 * Neutral, food-supporting colors with parchment off-white base
 */

export const colors = {
  // Primary palette
  parchment: '#F5F5F0',
  beige: '#E8E8E0',
  lightGray: '#D4D4CE',
  warmGray: '#B8B8B0',
  
  // Text colors
  black: '#1A1A1A',
  darkGray: '#4A4A4A',
  mediumGray: '#6B6B6B',
  lightText: '#8A8A8A',
  
  // Accent colors
  accent: '#FF6B35', // Primary orange accent
  accentGreen: '#8B9A7A',
  accentBrown: '#9B8B7A',
  
  // Status colors
  success: '#6B8E6B',
  error: '#C85A5A',
  warning: '#D4A574',
  info: '#7A8B9B',
  
  // Food colors (saturated, used sparingly)
  foodRed: '#D85A5A',
  foodOrange: '#E8A574',
  foodGreen: '#7A9B7A',
  
  // Backgrounds
  white: '#FFFFFF',
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
  
  // Borders
  border: '#E0E0DA',
  borderLight: '#F0F0EA',
} as const;

export type ColorKey = keyof typeof colors;

