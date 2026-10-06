# Pomodoro

A Vue 3 + TypeScript focus timer with a configurable session sequence.

## Netlify deployment

Import `BrownYoga/pomodoro` from GitHub in Netlify and choose `main` as the
production branch. Leave the base directory empty. The checked-in
`netlify.toml` runs `pnpm test:unit && pnpm build` and publishes `dist`.
`.nvmrc` selects Node 24, and `package.json` pins pnpm 12.9.1.

Netlify automatically installs dependencies using `pnpm-lock.yaml`. Unit tests
and typechecking must pass before a new build is published. E2E tests remain a
separate local check. After linking the repository, each push to `main` triggers
a fresh deployment. Committing this configuration alone does not link the
Netlify account or create a hosted site.

Setup: [Import a Git repository](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).
Version configuration: [Netlify dependency management](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

## Use the app

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Start, pause, resume, or reset the current
session. The progress ring, page title, and status follow the timer. You can
write a focus intention and see completed focus sessions for this visit.

The defaults are 25-minute focus sessions, 5-minute rests, and a 15-minute long
rest after four focus sessions. The old 65-second starter settings automatically
upgrade; custom settings are preserved.
Open Settings to choose a focus duration and enable alternating rest sessions.
Durations are entered in minutes (enter 25 for a 25-minute session). Decimals
are supported, such as 0.5 for 30 seconds; the timer stores whole seconds internally.
Long rests are
optional: choose a frequency from 1 to 12, or 0 to disable them. No fixed
four-session rule is required: the default frequency is editable. You can select Focus, Rest, or Long rest directly;
switching stops and resets that session without counting it as a completion.

Each completed session prepares the next one but waits for Start. Reset restores
the current session and preserves the completed count. Saving settings starts a
fresh sequence and clears the count. A standalone focus timer stops at zero;
Reset makes it ready again.

Settings are saved in this browser. Reloading starts a fresh timer and clears
this visit's count. Invalid saved data falls back to defaults; if storage is
unavailable, settings still apply for the current visit. The focus intention is
not persisted. Optional accounts use Netlify Identity; timer state and settings
are not uploaded or synchronized yet.

## Accounts

Sign in opens an email/password dialog. Guests can keep using every timer feature.
Account creation supports email confirmation, and Forgot password sends a reset
link. Confirmation, recovery, and invitation links are processed on page load.
Signing in or out does not reset the timer. The Identity SDK manages the saved
authentication session; the app does not save passwords.

After deploying, open [this project's Identity settings](https://app.netlify.com/projects/ashwillpomodoro/identity)
and select **Enable Identity**. Leave registration open to allow Create account,
or use invite-only registration. Keep email confirmation enabled. Test signup,
confirmation, sign-in, password recovery, and sign-out on the HTTPS deployed site.
No client secret or environment variable is needed for email/password login.
If Identity is unavailable, the account dialog offers a retry and guest timers
continue working. Plain `pnpm dev` does not provide a real Identity service.

Automated account tests mock the Identity SDK or its HTTP responses; they do not
create live accounts or send real emails. Cross-device timer persistence and sync
will be a separate change. Accounts alone do not make a running timer follow you
to another device.

Setup reference: [Netlify Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/).

Enable completion sound in Settings for a short chime. Audio is activated when
you press Start and depends on the browser allowing audio playback. The app also
shows a completion message. While the page is active, Space toggles start/pause
and R resets; shortcuts do not intercept typing or button activation.

## Architecture

- `src/domain/timer.ts`: pure formatting and decrementing utilities.
- `src/domain/pomodoro.ts`: session validation, initialization, transitions, counts.
- `src/domain/settings.ts`: configuration validation and session sequence creation.
- `src/composables/usePomodoro.ts`: reactive state, lifecycle, and clock scheduling.
- `src/composables/useSettings.ts`: browser storage boundary.
- `src/composables/useAuth.ts`: Netlify Identity session and authentication boundary.
- `src/composables/useCompletionSound.ts`: optional browser audio boundary.
- `src/components`: display, controls, and settings dialog with scoped SCSS.
- `src/App.vue`: composes the screen, keyboard input, title, and completion feedback.
- `src/tests`: Vitest + Vue Test Utils tests; domain tests run without Vue.
- `e2e`: Chromium tests using `data-testid` and a controlled browser clock.

The countdown uses a timestamp deadline rather than assuming each scheduled
callback runs on time. Pausing preserves partial seconds. All clock resources
are cleaned up when the component unmounts. Background browser scheduling can
delay visual updates or sounds, but the next callback reconciles elapsed time.
Closing the page stops the app; this is not a background alarm service.

## Verification

```sh
pnpm test                 # Unit/component tests in watch mode
pnpm test:unit            # Unit/component tests once
pnpm exec playwright install chromium
pnpm test:e2e             # Starts Vite on 127.0.0.1:4173 automatically
pnpm test:e2e:ui          # Interactive Playwright runner
pnpm build               # Typecheck and production build
pnpm preview             # Serve the production build
```

Build and tests are independent. Tests use the real production API types.
E2E coverage includes countdown, pause/resume, reset, status, session completion,
configured long rests, settings validation/persistence, storage failure,
keyboard shortcuts, and mobile layout. Screenshots are written to ignored
`test-results/`; failures retain Playwright traces. No skipped or TODO tests.

References: [Vue reactivity](https://vuejs.org/api/reactivity-core.html),
[Playwright clock](https://playwright.dev/docs/clock),
[Vitest configuration](https://vitest.dev/config/).
