# Finance

A local-first personal finance app for one person, built with Expo (React Native) for iOS and
Android from a single codebase.

> This is a planning tool, not licensed financial advice.

## What it does

- **Every credit product in one list.** Credit cards from any bank or country plus Chinese
  consumer credit such as 花呗 (Huabei), 借呗 (Jiebei), 网商贷 (Wangshangdai), 京东白条 and
  微粒贷, sorted by the next due date, with local reminders before each one.
- **Best card to use today.** Ranks cards by interest-free days for a purchase made today, with a
  30-day calendar. Loans that charge daily interest from day one (借呗, 网商贷) are never ranked
  as "free float"; the app shows their real cost instead.
- **Portfolio planner.** Income, credit debt, housing, insurance, cash, bonds and stocks feed a
  transparent rules engine that proposes an ordered plan and a target allocation, with the
  reasoning spelled out for every recommendation.
- **Private by design.** All data stays on the device in SQLite. No account, no backend, no
  analytics. Encrypted backups let you move to a new phone.
- Simplified Chinese and English, multi-currency with a home currency and editable FX rates, and an
  app lock with Face ID or fingerprint.

## Status

| Phase | Scope                                                                   | State |
| ----- | ----------------------------------------------------------------------- | ----- |
| 1     | Project setup, design research, design system, navigation shell         | Done  |
| 2     | Credit products: data model, add/edit screens, countdown, notifications | Done  |
| 3     | Payment optimizer and "Best card to use today"                          | Next  |
| 4     | Portfolio inputs: income, housing, insurance, bonds, stocks, risk       |       |
| 5     | Portfolio planner engine, dashboard and charts                          |       |
| 6     | Polish: animations, i18n pass, app lock, backup/export, screenshots     |       |

## Run it

You need Node.js 20 or newer and npm. Then:

```bash
npm install
```

### On your phone with Expo Go (quickest)

1. Install **Expo Go** from the App Store or Google Play. The store version supports Expo SDK 58,
   which this project uses.
2. Start the dev server:

   ```bash
   npm start
   ```

3. Scan the QR code in the terminal: with the Camera app on iPhone, or from inside Expo Go on
   Android. Your phone and computer need to be on the same Wi-Fi network; if they cannot see each
   other, run `npm start -- --tunnel`.

Nothing is preloaded. To look around with sample cards and loans, open **Me → Load demo data**
(and **Remove demo data** to delete exactly those items again).

Expo Go limits worth knowing:

- **Face ID does not work in Expo Go on iOS**, so the app lock falls back to your device passcode
  there. Fingerprint unlock on Android works.
- Notifications are local only, which is all this app uses, so reminders work in Expo Go. The app
  asks for permission after you add your first card or loan; reminders fire at 09:00, 3 days and
  1 day before each due date by default (change both under **Me → Reminders**).

### With a development build

A development build is your own installable app with all native modules compiled in. Use it for
Face ID on iOS, or once you want an app icon on your home screen that does not depend on Expo Go.

With EAS Build (no Xcode or Android Studio needed):

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # links the project to your Expo account
npx eas-cli@latest build --profile development --platform ios      # or android
```

Install the build on your phone from the link EAS gives you, then start the dev server for it:

```bash
npm run start:dev
```

Or build locally if you have Xcode or Android Studio installed:

```bash
npx expo run:ios
npx expo run:android
```

## Scripts

| Command               | What it does                                       |
| --------------------- | -------------------------------------------------- |
| `npm start`           | Dev server for Expo Go                             |
| `npm run start:dev`   | Dev server for a development build                 |
| `npm test`            | Jest unit tests                                    |
| `npm run lint`        | ESLint with Prettier formatting rules              |
| `npm run typecheck`   | TypeScript in strict mode                          |
| `npm run check`       | All three of the above                             |
| `npm run format`      | Format everything with Prettier                    |
| `npm run db:generate` | New SQL migration after editing `src/db/schema.ts` |

## Project layout

```text
src/
  app/          Routes (expo-router). Every file is a screen; _layout files are navigators.
  components/   Design-system components: Card, StatTile, ProgressRing, DueBadge,
                AmountText, BottomSheet, EmptyState, TabBar, form fields, pickers, ...
  db/           SQLite schema (Drizzle), connection and migrations runner, repositories,
                live queries, demo data
  design/       Tokens (colour, type, spacing, radius, shadow, motion), theme, motion helpers
  domain/       Pure finance logic with unit tests: dates, billing cycles, loans, payments,
                due status, reminders, FX, money formatting, form validation
  features/     Feature UI built from the components (credit: card art, card deck, product
                form, payment sheet, reminder scheduling)
  hooks/        useToday, useForm, useCountUp
  i18n/         English and Simplified Chinese strings, language detection
  lib/          Platform helpers (haptics, notifications, date formatting, dialogs)
  state/        App-wide state: database gate, preferences, credit data, toasts
drizzle/        Generated SQL migrations (bundled into the app as strings)
docs/
  design.md     Mobbin research and the design system it led to
```

## Privacy and security

- Data never leaves the phone unless you export a backup yourself.
- No analytics, crash reporting or network calls.
- Secrets (such as the app-lock setting) live in the OS keychain/keystore via `expo-secure-store`.
- Never commit real financial data: `.gitignore` blocks local databases, backups, `.env` files
  and signing keys.

## Design

See [docs/design.md](docs/design.md) for the reference apps studied on Mobbin, what was taken from
each, and the resulting design system (colour tokens with contrast ratios, type scale, motion
rules, accessibility).
