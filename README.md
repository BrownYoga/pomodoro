# Pomodoro learning project

Vue 3 + TypeScript + Vite, developed by making behaviour tests pass one at a time.

## Layers

- `src/domain`: pure TypeScript calculations and session rules, independent of Vue.
- `src/composables`: Vue refs, clock lifecycle, and calls to domain functions.
- `src/components`: display supplied values and emit control actions.
- `src/tests`: runnable domain, composable, and component tests.
- `e2e`: Playwright tests using `data-testid` selectors against the assembled UI.

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm test                 # Vitest watch mode
pnpm test:unit            # All unit/component tests once
pnpm test:unit src/tests/composables/usePomodoro.test.ts
pnpm exec playwright install chromium
pnpm test:e2e             # Starts Vite automatically on port 4173
pnpm test:e2e:ui
```

Tests are independent of the production build. Vitest discovers
`src/tests/**/*.test.ts`; Playwright discovers `e2e`. Domain tests run in Node;
Vue tests use jsdom. Missing implementations fail normally, without artificial
assertions, TODO tests, or suppressed failures.

## Proposed contracts to implement

`src/tests/contracts.ts` documents the future API. It contains types only.
Tests cast existing imports to these contracts so the build stays usable while
methods and exports are absent. Those casts do not create functions or hide
runtime failures. Copy/adapt the contracts into production modules as you build.
No production implementation was changed when completing these tests.

### Domain sessions

Export `createSessionState(sessions)` and `completeSession(sessions, state)`
from `src/domain/pomodoro.ts`.

Each supplied session has `id`, `durationSeconds`, and `countsAsFocus`.
The returned state has `sessionIndex`, `remainingSeconds`, and
`completedFocusSessions`. Initialization starts at index zero with the first
supplied duration and zero completions. Completion advances to the next entry,
wraps at the end, loads its duration, and increments the count only when the
finished entry has `countsAsFocus: true`. Return new state without mutating inputs.

The configured sequence may include any durations or arrangement of rests.
The short numbers in tests are fixtures, not app defaults. No 25/5/15 durations
or every-four-sessions rule is prescribed.

### Composable

`usePomodoro(configuration)` accepts either a standalone number of seconds
(the existing countdown API) or the supplied session array above.

Return `remainingSeconds`, `isRunning`, `activeSessionId`, and
`completedFocusSessions` refs, plus `start()`, `pause()`, and `reset()`.
The session refs are tested only for array configuration.

The tests specify these proposed behaviours:

- Initially idle; starting counts down once per second.
- Calling start while already running does not create another clock.
- Pause stops the clock; resume continues from the remaining time.
- Reset stops the clock and restores the current session's configured duration.
  It preserves the current session and completed count.
- A standalone numeric timer stops at zero.
- Finishing a configured session prepares the next one and waits for start.
- Completed rests do not increment the focus count.
- Unmounting stops the clock and prevents further updates.

These lifecycle behaviours are explicit test contracts. If you prefer different
reset or auto-start behaviour, change those expectations before implementing.
The tests check observable state; the domain/composable separation is an
architectural requirement, rather than a test of internal function calls.

### Components and E2E

| Component | Input | Output / selector |
| --- | --- | --- |
| TimerDisplay | `value`: formatted string | `[data-testid="timer-display"]` displays and updates that value |
| TimerControls | `isRunning`: boolean | `start`, `pause`, `reset` events |
| TimerControls | Idle state | `[data-testid="start-button"]` |
| TimerControls | Running state | `[data-testid="pause-button"]` |
| TimerControls | Either state | `[data-testid="reset-button"]` |

Current E2E tests check the display and start/pause control interaction. They
are not yet an assertion of session durations or countdown integration.

Tool references: [Vitest configuration](https://vitest.dev/config/),
[Vue Test Utils](https://test-utils.vuejs.org/installation/),
[Playwright test IDs](https://playwright.dev/docs/locators#locate-by-test-id),
and [Playwright web server](https://playwright.dev/docs/test-webserver).
