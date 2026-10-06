# Pomodoro

A Vue 3 + TypeScript focus timer with a configurable session sequence.

## Use the app

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Start, pause, resume, or reset the current
session. The progress ring, page title, and status follow the timer. You can
write a focus intention and see completed focus sessions for this visit.

The starting timer remains the 65-second example from the learning project.
Open Settings to choose a focus duration and enable alternating rest sessions.
Durations are entered in minutes (enter 25 for a 25-minute session). Decimals
are supported, such as 0.5 for 30 seconds; the timer stores whole seconds internally.
Long rests are
optional: choose a frequency from 1 to 12, or 0 to disable them. No fixed
four-session rule is imposed. You can select Focus, Rest, or Long rest directly;
switching stops and resets that session without counting it as a completion.

Each completed session prepares the next one but waits for Start. Reset restores
the current session and preserves the completed count. Saving settings starts a
fresh sequence and clears the count. A standalone focus timer stops at zero;
Reset makes it ready again.

Settings are saved in this browser. Reloading starts a fresh timer and clears
this visit's count. Invalid saved data falls back to defaults; if storage is
unavailable, settings still apply for the current visit. The focus intention is
not persisted. There is no account, backend, or data upload.

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
