import { usePathname } from 'expo-router';
import { createContext, useState, type PropsWithChildren } from 'react';

export const StandaloneEntryContext = createContext(false);
const TAB_PATHS = new Set(['/', '/credit', '/wealth', '/settings']);

/**
 * The router seeds a tabs anchor for deep links, but that anchor initially selects Home.
 * Until the user leaves the entry page, Back should select its owning tab instead.
 * After real navigation, preserve the previous screen and its scroll state with a normal pop.
 */
export function BackNavigationProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [entryPath] = useState(pathname);
  const [hasNavigated, setHasNavigated] = useState(false);
  if (!hasNavigated && pathname !== entryPath) setHasNavigated(true);
  return (
    <StandaloneEntryContext.Provider
      value={!hasNavigated && pathname === entryPath && !TAB_PATHS.has(entryPath)}>
      {children}
    </StandaloneEntryContext.Provider>
  );
}
