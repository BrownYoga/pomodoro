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

After Start, focus and rest periods advance automatically through the long rest.
Finishing the long rest stops the cycle and offers **Start next session**.
**Skip break** skips a short rest straight to focus, preserving running or paused
state; skipping the long rest ends the cycle. Focus periods cannot be skipped
with this control. With long rests disabled, focus and short rests keep alternating
until paused or reset. Reset restores
the current period and preserves the completed count (**Reset timer**, or R).
**Reset session** stops the timer, returns to the first focus period, and clears
the completed count, keeping your durations and sound preference. This also
resets your shared account timer when signed in. Changing timer durations
or the session sequence starts a fresh sequence and clears the count. Changing
only completion sound preserves the current session, countdown, and completed count.
The sound preference is saved to your account when signed in, or in this browser
for guests. A standalone focus timer stops at zero;
Reset makes it ready again.

Guest settings are saved in this browser. Reloading as a guest starts a fresh timer and clears
this visit's count. Invalid saved data falls back to defaults; if storage is
unavailable, settings still apply for the current visit. The focus intention is
not persisted. Signed-in accounts share timer state, completed focus count, and
settings through Netlify Database.

## Optional study music

**Brown noise** plays a low rumble generated locally with Web Audio. No account,
audio download, or external service is required. Use its button to play, pause,
or resume; the small panel offers volume and a stop/close control. Selecting
brown noise stops YouTube music, and selecting either music option stops noise.
It quiets for voice cues and closes for breaks, restarting with focus only if it
was previously playing. Pausing or closing manually cancels automatic restart.
The noise uses a looping buffer with an overlap to smooth the boundary. Browser
audio restrictions may require another click; failures show a retry message.

**YouTube Music** opens a song/playlist panel next to **Play Lo-fi**. Copy a
YouTube Music or YouTube share link and select **Play music**. Public or unlisted
embeddable content plays in the visible YouTube player, with volume, pause/resume,
voice-cue quieting, and the same focus/break behavior as lo-fi. Only one source
plays at a time. Resuming a paused song keeps its position; restarting after a
break recreates the player from the submitted song or playlist's beginning.
Music never starts automatically on page load. Opening the panel alone loads no YouTube
scripts. Private, restricted, or Music-only tracks may not play in embeds; use
the external YouTube Music links as a fallback.

Sign in to your **Pomodoro account** to use the library. Paste a link, optionally
enter a name, and choose **Save to library**, or choose **Save current song** to
capture the song actually playing after a playlist or autoplay advances. This
updates the text field to that song's standalone link without interrupting playback.
An unnamed song uses its YouTube title when metadata is available; your typed
name takes priority, including when saving the current song after deleting it.
Unavailable metadata falls back to a video ID so saving still works. The external
track link also follows the actual playing song. Title lookup uses the same-origin
`music-title` function (also served by Vite during development).

**Your library** opens a separate modal with search, song/playlist filters,
play buttons, and deletion. The list stays out of the compact player. Saving an
existing song updates its name instead of duplicating it, including short links
and links to that song in different playlists. Playlist-only links remain separate.
The database migration merges older duplicate song entries, keeping the newest name.
Deleting an entry does
not interrupt current playback. Links can be saved and deleted during breaks.

**Shuffle library** queues each saved individual song once in a shuffled order,
without its original playlist/radio context. Playlist-only links are excluded
and can be played separately. YouTube's native playlist handles progression;
**Next song** skips within the queue. The remaining queue survives a focus break,
restarting the current song when focus resumes. YouTube controls playback
availability, autoplay restrictions, and recommendations after the queue ends;
the app cannot guarantee personalised recommendations afterward.

Library entries are stored in Netlify Database, scoped to the server-verified
Identity user ID, and load on sign-in or reload on another device. Guests can
play links but cannot access a saved library. Signing out or switching accounts
clears library data, input fields, and YouTube playback. No library data or last
link is read from shared browser storage; the previous guest library is not
automatically assigned to whichever account next signs in. Failed writes are
reported and do not pretend to have saved. Authentication is refreshed once after
a 401; if it still fails, the private list is cleared and sign-in is requested.
Use **Retry library** if the initial load fails. Library reads/writes use the
`/.netlify/functions/music-library` function and the
`20261024120000_music_library.sql` migration. This backend requires Netlify;
plain Vite uses a local development library for signed-out testing.

With `pnpm dev`, signed-out users can save, delete, search, and shuffle links
without signing in or running the backend. This development library persists
under a separate browser-storage key and makes no library API calls. Signing in
switches to the account library; signing out restores the local development
library. The two libraries are never merged automatically. Production builds
disable this guest library and require sign-in for saved libraries.

This first version is available without a subscription. It does not link Google
accounts or import a personal Music library. The official YouTube IFrame API
provides playback; YouTube Data API account access would require a Google Cloud
OAuth client, consent configuration, and a separate implementation. Authorizing
the Data API does not sign the embedded player into a YouTube Music subscription.
See [player support](https://developers.google.com/youtube/player_parameters) and
[Google OAuth requirements](https://developers.google.com/youtube/data/guides/authentication).

Use **Play Lo-fi** in the bottom-left corner to open Lofi Girl's official YouTube
study radio. Nothing from YouTube loads until you choose music. Pause/resume and
volume affect music only; stopping closes and destroys the player. Breaks also close
and destroy it; music that was playing restarts in a fresh player when focus
starts again, preserving your volume. Manually paused or stopped music stays off.
When completion sound is enabled, music fades to silence from three seconds remaining. A voice
recording starts at two seconds remaining; music returns to your chosen volume
after the recording, if focus is active. **Test audio** also silences
music during its preview. Volume edits during this interval apply when music
returns; manually pausing or stopping music stays respected. With completion
sound disabled, music still closes for breaks and restarts with focus.

The feature uses the free YouTube IFrame API without keys or extra dependencies.
The configured video ID is `rFZHOHl-L8A`: verified on 2026-10-21 against
[the official channel](https://www.youtube.com/@LofiGirl/streams), its
[watch page](https://www.youtube.com/watch?v=rFZHOHl-L8A) (live and embeddable),
and YouTube's oEmbed response. Previous IDs `jfKfPfyJRdk` and `X4VbdwhkE10`
were unavailable. If the broadcast moves, update `LOFI_VIDEO_ID` in
`src/config/lofi.ts` after checking the official channel. Use only the video ID
(the value after `v=` in the YouTube URL), then rebuild/redeploy the app.

The visible player is at least 200 × 200 pixels. YouTube's own controls report
live status; we don't infer LIVE from playback or archived live content. Explicit
starts/resumes through our control seek to the API's reported duration as a
best-effort attempt to reach the latest available position. YouTube controls the
seek window and buffering; precise live synchronization is not guaranteed.
See the [IFrame API reference](https://developers.google.com/youtube/iframe_api_reference).

Unit and browser tests mock YouTube. Manually check real playback, pause/resume,
volume and stopping on desktop and mobile (including Safari/iOS). Browser autoplay
restrictions may require pressing play inside the visible YouTube player; some
mobile browsers require hardware volume controls. Also check content blockers,
network failure, regional restrictions and embedding errors on the deployed
HTTPS site. A message and an Open on YouTube link provide a fallback.

## Accounts

Sign in opens an email/password dialog. Guests can keep using every timer feature.
Account creation supports email confirmation, and Forgot password sends a reset
link. Confirmation, recovery, and invitation links are processed on page load.
Signing in loads your account's shared timer (a new account starts with defaults).
Signing out keeps the displayed timer available as a guest; guest changes do not
update the saved account timer. The Identity SDK manages the saved
authentication session; the app does not save passwords.
If a timer request is rejected as unauthenticated, the app asks Identity to refresh
the session and retries once. If it is still rejected, **Sign in again** opens the
login dialog with the account email filled in. The displayed timer stays in place
while reconnecting; signing in reloads the saved account timer.
Signup asks for your name; existing accounts can click **Add your name** (or their
current name) in the header to edit it. Every password form has a Show / Hide button.

After deploying, open [this project's Identity settings](https://app.netlify.com/projects/ashwillpomodoro/identity)
and select **Enable Identity**. Leave registration open to allow Create account,
or use invite-only registration. Keep email confirmation enabled. Test signup,
confirmation, sign-in, password recovery, and sign-out on the HTTPS deployed site.
No client secret or environment variable is needed for email/password login.
If Identity is unavailable, the account dialog offers a retry and guest timers
continue working. Plain `pnpm dev` does not provide a real Identity service.

Automated account tests mock the Identity SDK or its HTTP responses; they do not
create live accounts or send real emails.

## Cross-device sync

Use the same account on your PC and phone. Start, pause, resume, reset, session
selection, settings, and completed focus counts are saved to your account. Signing
in or reloading fetches the saved timer; control actions send updates. There is
no automatic polling, focus-triggered fetching, or realtime subscription. A device
already open keeps its local countdown until it reloads or sends an action. If
another device changed the timer, a stale action loads the latest state and asks
you to try the action again. A saved finish
timestamp keeps the countdown correct after reloads or closing the app, even if
the devices have different system clocks. Elapsed focus and rest periods advance
through the long rest, then wait for **Start next session**. Expired periods are
reconciled by the server without a background worker.

The Netlify Function at `/.netlify/functions/timer` verifies Identity on the
server and chooses the database row from the verified user ID. POST requests
require a matching Origin and JSON content type. SQL queries use parameters;
revision checks reject stale writes rather than overwriting another device.
An offline device keeps displaying the countdown but cannot save control actions.
There is no offline action queue or automatic retry; retry a failed action yourself,
or reload if the initial account load failed. Timer completion makes no API call;
the server resolves the saved deadline on the next load or action.

`@netlify/database` and the SQL migration under `netlify/database/migrations`
allow Netlify to provision the database and apply the schema during deployment.
This needs a supported credit-based Netlify plan and uses database/function
credits. If the deploy cannot provision it, check **Data & Storage → Database**
and the deploy log. Keep database credentials on the server; none belong in
`VITE_*` environment variables. Plain Vite serves guest mode; use `netlify dev`
for backend development. Live authenticated sync must be checked on the deployed
HTTPS site using your own account.

Database setup: [Netlify Database getting started](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/).

Setup reference: [Netlify Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/).

Enable **Voice cues for focus and rest** in Settings to use the MP3 recordings
in `src/assets/Sounds`: “It's time to take a break” before a short rest,
“Your session has been completed” before the long rest, and “It's time to start
studying again” when a rest ends. These replace the synthesized gong and begin
with two seconds remaining. If a delayed browser callback misses this window,
the latest transition is announced when the timer catches up, without repeating
a cue already played. Use **Test audio** to preview the current period's cue at your device's volume without
changing your saved preference. Sound is off by default. Audio is activated when
you interact with the app (including starting lo-fi after restoring a running
timer) and depends on the browser allowing audio playback. The app also
shows a completion message. While the page is active, Space toggles start/pause
and R resets; shortcuts do not intercept typing or button activation.

## Architecture

- `src/domain/timer.ts`: pure formatting and decrementing utilities.
- `src/domain/pomodoro.ts`: session validation, initialization, transitions, counts.
- `src/domain/settings.ts`: configuration validation and session sequence creation.
- `src/domain/sharedTimer.ts`: shared state, timestamp transitions, and validation without Vue.
- `src/composables/usePomodoro.ts`: reactive state, lifecycle, and clock scheduling.
- `src/composables/useSettings.ts`: browser storage boundary.
- `src/composables/useAuth.ts`: Netlify Identity session and authentication boundary.
- `src/composables/useTimerSync.ts`: account loading, commands, conflicts, and clock alignment.
- `netlify/functions/timer.ts`: authenticated API with conditional Postgres updates.
- `netlify/database/migrations`: versioned Postgres schema.
- `src/composables/useCompletionSound.ts`: optional browser audio boundary.
- `src/components`: display, controls, and settings dialog with scoped SCSS.
- `src/App.vue`: composes the screen, keyboard input, title, and completion feedback.
- `src/tests`: Vitest + Vue Test Utils tests; domain tests run without Vue.
- `e2e`: Chromium tests using `data-testid` and a controlled browser clock.

The countdown uses a timestamp deadline rather than assuming each scheduled
callback runs on time. Pausing preserves partial seconds. All clock resources
are cleaned up when the component unmounts. Background browser scheduling can
delay visual updates or sounds, but the next callback reconciles elapsed time.
Closing the page stops UI updates and sound; signed-in timers retain their finish
timestamp. This is not a background alarm service.

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
keyboard shortcuts, mobile layout, accounts, and three-browser sync. Server tests
apply the real SQL migration to PGlite (embedded Postgres) and check account
isolation, request validation, and concurrent updates. Screenshots are written to ignored
`test-results/`; failures retain Playwright traces. No skipped or TODO tests.

References: [Vue reactivity](https://vuejs.org/api/reactivity-core.html),
[Playwright clock](https://playwright.dev/docs/clock),
[Vitest configuration](https://vitest.dev/config/).
