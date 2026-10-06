# Pomodoro learning project

Vue 3 + TypeScript + Vite with a TDD scaffold. The app is still blank;
no countdown, controls, reactive timer state, or Pomodoro rules are implemented.

## Layers

```text
src/
  domain/
    timer.ts                       # Plain TypeScript timer utility contracts
    pomodoro.ts                    # Placeholder for rules you will choose
  composables/
    usePomodoro.ts                 # Placeholder for Vue state and clock lifecycle
  components/
    TimerDisplay.vue               # Empty display component
    TimerControls.vue              # Empty controls component
  tests/
    domain/
      timer.test.ts
      pomodoro.test.ts
    composables/
      usePomodoro.test.ts
    components/
      TimerDisplay.test.ts
      TimerControls.test.ts
e2e/
  pomodoro.spec.ts
vitest.config.ts
playwright.config.ts
```

The domain owns calculations and rules, with no Vue or browser dependencies.
The composable will call the domain and own `ref()` state, the clock, and
start/pause/reset. Components will display values and emit actions; `App.vue`
will connect them. E2E tests will exercise the assembled application.

Durations, break sequence, completed-focus counting rules, and reset semantics
are deliberately undecided. Session-rule and composable tests use `it.todo`
until you define those contracts.

## Commands

```sh
pnpm install
pnpm dev
pnpm build
pnpm test                 # Vitest watch mode
pnpm test:unit            # One Vitest run
pnpm exec playwright install chromium  # Browser setup on each machine
pnpm test:e2e             # Chromium E2E; starts Vite automatically on port 4173
pnpm test:e2e:ui          # Interactive Playwright runner
```

Build and tests are independent: a failing test does not prevent building or
running the app. Vitest only discovers `src/tests/**/*.test.ts`; Playwright
only discovers tests under `e2e`. Domain tests run in Node; Vue component tests
use jsdom and Vue Test Utils. Test and configuration files are also typechecked
by the build.

## Starting in red

Timer functions contain only signatures and explicit TODO errors. Their tests
fail because those functions are unimplemented. Component and E2E tests fail
because the required elements do not exist. There are no deliberately false
assertions, expected-failure markers, or suppressed failures. Missing selectors
produce normal test failures and a nonzero exit code.

The proposed UI contracts are:

| Component | Input | Output / selector |
| --- | --- | --- |
| TimerDisplay | `value`: formatted string | `[data-testid="timer-display"]` displays that value |
| TimerControls | `isRunning`: boolean | `start`, `pause`, `reset` events |
| TimerControls | Idle state | `[data-testid="start-button"]` |
| TimerControls | Running state | `[data-testid="pause-button"]` |
| TimerControls | Either state | `[data-testid="reset-button"]` |

These are contracts to implement, not existing functionality. `App.vue` does not
yet import the placeholder components. Start with the timer utility tests, then
decide session rules, define the composable contract, and connect the UI.

Tool references: [Vitest configuration](https://vitest.dev/config/),
[Vue Test Utils](https://test-utils.vuejs.org/installation/),
[Playwright test IDs](https://playwright.dev/docs/locators#locate-by-test-id),
and [Playwright web server](https://playwright.dev/docs/test-webserver).
