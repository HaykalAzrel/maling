# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the web app: `app/` for pages and UI, `hooks/` for React hooks, `services/` for Firebase/device integrations, `store/` for Zustand state, `types/` for shared models, and `styles/` for global CSS. Static web assets live in `public/`, design assets in `assets/`, and native Capacitor shells in `android/` and `ios/`. Firebase Cloud Functions live in `functions/src/`; treat `functions/lib/` as generated output and do not edit it directly.

## Build, Test, and Development Commands
Use Bun at the repo root: `bun install`, `bun run dev` for Vite, and `bun run build` for production. Capacitor workflows expect Bun because the scripts shell out to `bun`/`bunx`: use `bun run cap:prepare`, `bun run cap:android`, and `bun run cap:ios`. Refresh brand assets with `bun run assets:generate`. Use npm only inside `functions/`: `cd functions && npm install && npm run build`, or `cd functions && npm run serve` for the Firebase Functions emulator. `pnpm-workspace.yaml` exists, but there is no active pnpm workflow.

## Coding Style & Naming Conventions
TypeScript is in `strict` mode, so keep types explicit and avoid `any`. Match the surrounding style in each file: most app code uses 2-space indentation and functional React components. Use `PascalCase` for pages and components (`DeviceDetailPage.tsx`), `camelCase` for services and utilities (`notificationService.ts`), and `useX` for hooks (`useFirebaseDevices.ts`). Keep feature code in `src/`; do not add logic to generated native or compiled folders.

## Testing Guidelines
There is no root test script yet. For web changes, the check is `bun run build` plus a test of the route or device flow in `bun run dev`. For Cloud Functions, run `cd functions && npm run build`, and use the emulator when changing notification or scheduling behavior. Android instrumentation scaffolding under `android/app/src/androidTest/` should be extended for Android-only code.

## Commit & Pull Request Guidelines
Recent commits use short imperative summaries such as `fix ringtone/vibration bug...`; keep that style, but prefer specific scopes over vague messages like `perubahan banyak`. Keep each commit focused on one concern. Pull requests should describe the change, list touched areas (`src`, `functions`, `android`, or `ios`), include manual test notes, link the issue when available, and attach screenshots or recordings for UI, alarm, or notification changes.

## Security & Configuration Tips
Keep `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`, `google-services.json`, and signing credentials out of new commits. Store machine-specific secrets in local env files or Gradle properties, and document any new required variables in `README.md`.
