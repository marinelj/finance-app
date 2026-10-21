import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { lightTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(lightTheme);

/** Light theme only for now; components read colours through the theme so dark can follow. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Builds a component's styles from the current theme. Pass a factory defined at module scope so
 * the result is memoised per theme.
 */
export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
