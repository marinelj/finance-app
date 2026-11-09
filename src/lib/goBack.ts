import { useRouter, type Href } from 'expo-router';
import { useContext } from 'react';

import { StandaloneEntryContext } from './BackNavigationProvider';

/** The tab a standalone stack page belongs to. Accepts route names or public paths. */
export function backFallback(route: string): Href {
  const name = route.replace(/^\//, '');
  if (name.startsWith('product/') && name !== 'product/new') return '/credit';
  if (name.startsWith('wealth/')) return '/wealth';
  if (name.startsWith('settings/')) return '/settings';
  return '/';
}

/** Keep real navigation history; a fresh standalone page still has somewhere to go. */
export function useGoBack(fallback: Href = '/') {
  const router = useRouter();
  const standaloneEntry = useContext(StandaloneEntryContext);
  return () => {
    if (standaloneEntry) {
      // Remove the generated deep-link stack before selecting the owning tab.
      if (router.canGoBack()) router.dismissAll();
      router.replace(fallback);
    } else if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
}
