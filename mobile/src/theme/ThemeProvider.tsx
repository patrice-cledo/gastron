import React, { createContext, useContext, ReactNode } from 'react';
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export interface Theme {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
}

const theme: Theme = {
  colors,
  typography,
  spacing,
};

const ThemeContext = createContext<Theme>(theme);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

