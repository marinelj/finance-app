import { lightColors } from '@/design/tokens';

import { isWeb } from './platform';

const STYLE_ID = 'finance-app-web-interactions';

/**
 * Browser-only CSS that React Native styles cannot express: a visible focus ring for keyboard
 * users (never for mouse clicks), pointer cursors, no grey tap flash on mobile browsers, and
 * slim scrollbars. Safe to call more than once.
 */
export function installWebStyles() {
  if (!isWeb || typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const interactive =
    '[role="button"],[role="tab"],[role="radio"],[role="checkbox"],[role="switch"],[role="link"],a';
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    ${interactive} { cursor: pointer; -webkit-tap-highlight-color: transparent; user-select: none; }
    [aria-disabled="true"] { cursor: default; }
    :focus { outline: none; }
    ${interactive
      .split(',')
      .map((s) => `${s}:focus-visible`)
      .join(',')} {
      outline: 3px solid ${lightColors.primary};
      outline-offset: 2px;
    }
    input:focus-visible, textarea:focus-visible { outline: none; }
    * { scrollbar-width: thin; scrollbar-color: ${lightColors.hairline} transparent; }
    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; }
    }
  `;
  document.head.appendChild(style);
}
