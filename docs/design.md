# Design notes

Target feel: **vivid, youthful, light, with smooth animation.** Bright accent colors on a
near-white background, rounded cards, generous spacing, playful but clean.

This document records what was taken from reference apps (layout and interaction patterns
only, no copied assets, logos or illustrations) and the design system that came out of it.

## Research method

References were pulled from [Mobbin](https://mobbin.com) (iOS screens) through the Mobbin MCP
tool on 2026-10-21. Robinhood is not in Mobbin's catalog, so Copilot, Public, Origin and Fidelity
stand in for the investing references. Links point to the screens on Mobbin (sign-in required).

## What we took from each reference

### Home / dashboard

| Reference                                                                               | Pattern we took                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Revolut home](https://mobbin.com/screens/e93d0c63-dfcf-4eb2-bd22-0be63f571215)         | One hero number centred on a saturated gradient, with a row of round icon buttons and short labels under it. Our Home hero shows **total owed** the same way.                         |
| [Revolut analytics](https://mobbin.com/screens/df7b1aab-511c-4959-9238-7ec8da733902)    | Two-column grid of stat tiles: label, big value, tiny supporting line, status dot ("On track"). Basis of `StatTile`.                                                                  |
| [Monzo home](https://mobbin.com/screens/d8fad0d1-f10e-4aa6-860c-46fe35e23d77)           | Warm gradient fading into a light page; horizontally scrolling summary tiles; amounts drawn with **smaller decimals** (`£221.08`). `AmountText` does the same.                        |
| [Rocket Money dashboard](https://mobbin.com/flows/d4cc0f80-7fe5-4bcb-b0d7-64617e591927) | "Upcoming" rail of small cards, each ending in a countdown footer ("IN 17 DAYS"). Our Home shows the next due items this way.                                                         |
| [Copilot dashboard](https://mobbin.com/screens/f1778c3a-ee4e-4bd7-960b-52db273f15d2)    | White rounded cards floating on a coloured header, emoji used as friendly category icons, colour bars that turn red only when something is over.                                      |
| [Alipay 理财](https://mobbin.com/screens/8a9cd7a2-ce9c-49a5-9481-443f9e220f16)          | Eye toggle next to 总资产 to hide amounts; dense grid of coloured shortcut icons. We add a **privacy toggle** that masks every amount. Note the Chinese market convention (red = up). |

### Card list (stack and swipe)

| Reference                                                                                  | Pattern we took                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple Wallet](https://mobbin.com/screens/5b49ae4b-f03b-4e28-b662-eb5cf9cc83f6)            | Vertical stack where each card shows only its top strip; colour plus issuer name is enough to recognise it.                                                                                 |
| [Monzo stacked accounts](https://mobbin.com/screens/f5c5680b-88b8-4289-b068-100b3484222d)  | Front card fully visible with pill actions, cards behind peeking above it. Our card list opens with a **swipeable deck**: the front card can be flicked away to bring the next one forward. |
| [Revolut onboarding](https://mobbin.com/screens/f1849dd9-ff56-4a81-af5a-5e670526fa67)      | Fanned card stack as the hero illustration, big bold headline, two full-width pill buttons.                                                                                                 |
| [Starbucks card carousel](https://mobbin.com/screens/8bf784df-aeea-4cc8-8c73-84f424d66e80) | Next card peeking at the edge makes "swipe for more" obvious without a hint.                                                                                                                |

### Card detail

| Reference                                                                                    | Pattern we took                                                                                                                                                |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple Card detail](https://mobbin.com/screens/23c06c82-2da7-4f30-9458-3e7c7e95b179)         | Gradient card art, then a 2×2 tile grid: balance + available, **Payment due** + a pay button. Our detail screen mirrors this grid.                             |
| [Rocket Money card](https://mobbin.com/screens/140a5d54-f7cc-4f83-883d-40cbae507e92)         | Utilization shown as a ring with the percentage inside and a plain verdict ("Low utilization") beside it. Basis of `ProgressRing` usage.                       |
| [CRED cards](https://mobbin.com/screens/12a90aef-920e-406c-8e15-281c0a63917e)                | Due date as a loud badge on the card ("DUE ON 4 APR") and a countdown sentence with the number highlighted ("next statement in 23 days"). Basis of `DueBadge`. |
| [Neo Financial utilization](https://mobbin.com/screens/74803641-ff31-4cfc-803a-748a81d0fa9e) | Bottom sheet that explains a metric in one sentence ("keep utilization below 30%"). We use sheets for explanations rather than new screens.                    |

### Add / edit forms

| Reference                                                                                  | Pattern we took                                                                                                              |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [Shop add order](https://mobbin.com/screens/d6299a71-ef6e-482a-9a53-f4cabfceac6c)          | Big bold title, fields with the label inside the box above the value, one vivid full-width primary button.                   |
| [Polarsteps add flight](https://mobbin.com/screens/cc1beeac-b90b-4656-97e1-47b911d0db4b)   | Leading icon per field, "Save" in the header, a muted ⓘ note for caveats.                                                    |
| [Starling add account](https://mobbin.com/screens/6e85a7ce-b2ba-4b46-a72c-24c38d3a10e7)    | Related fields grouped in one white card on the grey page. Our long forms (credit product, bond) are split into such groups. |
| [Neo Financial add payee](https://mobbin.com/screens/94be864a-084e-447d-a497-264a5fa10cb1) | Coloured icon tile at the top that previews the object being created. Our product form previews the card colour live.        |

### Portfolio / allocation

| Reference                                                                               | Pattern we took                                                                                                                                |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [Origin allocation](https://mobbin.com/screens/53b20603-3822-4a5e-8125-8c26381b2c49)    | Donut with gaps between segments, total in the centre, list below with dot + percentage + amount. That list doubles as the chart's table view. |
| [Fidelity allocation](https://mobbin.com/screens/a73b35e0-9bc7-4ac6-9f92-bbae926dff5d)  | One plain-language sentence under the chart ("most closely resembles an Aggressive Growth mix"). Every planner output gets such a sentence.    |
| [Revolut total wealth](https://mobbin.com/screens/5ba63fd5-6d4c-4149-a1d9-2ac6b6aec32d) | Assets / Liabilities segmented pills over one ring. Basis of the net-worth view.                                                               |
| [Copilot investments](https://mobbin.com/screens/ff5cb687-e8be-493b-b87d-07dd6016d7fe)  | Line chart with an end dot and pill-shaped range chips (1W 1M 3M YTD 1Y). Used for the net-worth trend and what-if projection.                 |
| [Monzo fund risk](https://mobbin.com/screens/5e995e45-221b-46e9-8da5-0f4b5a466e88)      | Risk level as a named label with a gauge icon and a short paragraph. Used for the risk-profile result.                                         |

### Onboarding and questionnaires

| Reference                                                                                     | Pattern we took                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Rocket Money budgeting setup](https://mobbin.com/flows/d4cc0f80-7fe5-4bcb-b0d7-64617e591927) | One question per step, thin progress bar at the top, answers as large radio cards with an optional "Recommended" tag, sticky Continue button. Used for the risk-profile questionnaire. |
| [Cash App card intro](https://mobbin.com/screens/ffcd8bc9-7ef7-4059-9d0b-37d37e20f821)        | Feature list with one icon per line, Skip / Next as stacked pill buttons. Used for first-run onboarding.                                                                               |
| [Monzo summary](https://mobbin.com/flows/8ea712b4-35df-4e50-bf84-cf798e4213c6)                | Big ring with the amount in the middle and "17 DAYS TO GO" riding the ring's end; a green pill with the verdict.                                                                       |

### Upcoming dues and calendars

| Reference                                                                                       | Pattern we took                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Lloyds upcoming payments](https://mobbin.com/screens/cd152d76-844d-411c-b3f7-a4b92a6c5cd2)     | Vertical timeline with a marker for "end of range". Used for the 30-day best-card calendar. |
| [Perplexity earnings calendar](https://mobbin.com/screens/1ef1a796-3cc3-4551-ad7c-5bf41eca3342) | Items grouped under sticky day headers. Used for payment history and installment schedules. |
| [Shopify billing](https://mobbin.com/screens/04916ea4-ad09-4a15-bf25-f54cbe98563e)              | "Next bill in 29 days" sentence plus a small green "Paid" pill.                             |

## Principles that came out of the research

1. **One hero number per screen.** Home leads with total owed, Credit with total due this
   month, Wealth with net worth. Everything else is smaller.
2. **Colour means something.** Accents decorate (icon chips, gradients); status colours
   (safe / due soon / overdue) are reserved and always come with an icon and a word.
3. **Cards on a near-white page.** White rounded cards (radius 22) on `#F6F6FB`, soft
   violet-tinted shadow, 16–24 pt padding.
4. **Explain, don't just show.** Every ratio and recommendation has a one-sentence "why".
5. **Motion confirms, never decorates.** Springs on things the user touched, count-up on
   balances when they change, nothing that loops. Everything turns off with Reduce Motion.

## Design system (in code: `src/design/`)

### Colour (light theme first)

Contrast ratios are WCAG 2.x and are enforced by `src/design/__tests__/contrast.test.ts`.

| Role                       | Value                                       | Notes                                        |
| -------------------------- | ------------------------------------------- | -------------------------------------------- |
| Background                 | `#F6F6FB`                                   | near-white with a hint of violet             |
| Surface (cards)            | `#FFFFFF`                                   |                                              |
| Text                       | `#14142B`                                   | 16.7:1 on background                         |
| Text secondary             | `#4E5070`                                   | 7.2:1                                        |
| Text muted                 | `#62657F`                                   | 5.3:1                                        |
| **Primary** (vivid violet) | `#6C4DFF`                                   | white text 5.1:1                             |
| Hero gradient              | `#5B3DF5 → #D6247F`                         | white text ≥ 4.75:1 at both ends             |
| Accent: pink               | `#FF4F9A`                                   | icon chips, highlights (never text on white) |
| Accent: mint               | `#13C39C`                                   | icon chips, highlights                       |
| Accent: sun                | `#FFC53D`                                   | icon chips, highlights                       |
| Semantic: safe             | mark `#0CA30C`, text `#006300` on `#E6F6E6` | text 6.7:1                                   |
| Semantic: due soon         | mark `#FAB219`, text `#8A5200` on `#FFF4DB` | text 5.8:1                                   |
| Semantic: overdue          | mark `#D03B3B`, text `#B42318` on `#FCE8E8` | text 5.6:1                                   |

Dark theme is out of scope for now; every component reads colours through semantic roles
(`useTheme().colors`), so a dark set can be added later without touching components.

**Chart palette** (categorical, fixed order, never cycled): `#2A78D6` blue, `#EB6834` orange,
`#1BAF7A` aqua, `#EDA100` yellow, `#E87BA4` magenta. Validated with the dataviz validator on the
white card surface: worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6, and the donut's wrap-around
pair (magenta→blue) ΔE 13.0. Aqua, yellow and magenta are below 3:1 against white, so every chart
ships with a labelled legend list that also serves as its table view.

### Typography

System sans everywhere (SF Pro / Roboto, with PingFang SC / Noto Sans CJK for Chinese), including
big numbers; no display face. This keeps Chinese and Latin weights consistent and avoids font
loading. Hero figures are 48 pt; proportional figures for big standalone numbers, tabular figures
only where numbers align in columns.

| Token      | Size / line | Weight                  |
| ---------- | ----------- | ----------------------- |
| `hero`     | 48 / 56     | 800                     |
| `display`  | 32 / 38     | 800                     |
| `title`    | 22 / 28     | 700                     |
| `headline` | 17 / 22     | 600                     |
| `body`     | 16 / 22     | 400                     |
| `callout`  | 15 / 20     | 500                     |
| `caption`  | 13 / 18     | 500                     |
| `micro`    | 12 / 16     | 600, used for overlines |

All text scales with the OS font size (Dynamic Type / Android font scale), capped at 1.6× for
the hero and display tokens so big numbers do not overflow their cards.

### Spacing, radius, elevation

- Spacing: 4-pt grid: `4 8 12 16 20 24 32 40 56`.
- Radius: `8 12 16 22 28` and `pill` (999).
- Elevation: React Native `boxShadow` (New Architecture), violet-tinted:
  `card = 0 6px 20px rgba(42,30,120,0.08)`, `raised = 0 12px 32px rgba(42,30,120,0.14)`.

### Motion

- Springs: `snappy` (350 ms perceptual, damping ratio 0.85) for presses and toggles,
  `bouncy` (500 ms, 0.6) for cards landing, `gentle` (550 ms, 1.0) for sheets.
- Number count-up on balances (600 ms, ease-out) when the value changes.
- Screens: native stack push on iOS and Android, with the content of each screen cascading in
  (fade + 12 pt rise, 40 ms stagger).
- Card deck on the credit list: drag, release past a threshold, card flies off and re-joins
  at the back with a haptic tick.
- Haptics (`expo-haptics`): selection on tab change and chips, light impact on card swipe,
  success notification on "mark as paid" and on save.
- **Reduce Motion:** every animation reads `useReducedMotion()`; when it is on, counts jump to
  the final value, layout animations are skipped and the deck switches without the fly-off.

## Decisions that differ from the original brief

- **moti is not used.** Its last release (0.30, January 2025) predates Reanimated 4, which this
  SDK ships. Reanimated 4's own layout animations and springs cover the same micro-animations
  without the compatibility risk.
- **Charts are drawn with `react-native-svg`** (donut, bars, line/area, ring) instead of
  victory-native or gifted-charts. The charts are simple, and owning them keeps the vivid style,
  the dataviz rules (2 px gaps, 2 px lines, end dots, recessive grid) and accessibility labels
  under our control, with no Skia dependency.
- **Forms use a small zod-backed hook** instead of react-hook-form, which has known friction with
  the React Compiler that this template enables.
