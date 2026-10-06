<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import TimerDisplay from "./components/TimerDisplay.vue";
import TimerControls from "./components/TimerControls.vue";
import TimerSettings from "./components/TimerSettings.vue";
import AccountMenu from "./components/AccountMenu.vue";
import { formatTime } from "./domain/timer";
import { buildConfiguration } from "./domain/settings";
import type { TimerSettings as Settings } from "./domain/settings";
import { usePomodoro } from "./composables/usePomodoro";
import { useSettings } from "./composables/useSettings";
import { useCompletionSound } from "./composables/useCompletionSound";

const { settings, save, storageMessage } = useSettings();
const timer = usePomodoro(buildConfiguration(settings.value));
const {
  remainingSeconds,
  isRunning,
  status,
  completedFocusSessions,
  activeSessionId,
  progress,
  sessions,
} = timer;
const sound = useCompletionSound();
const settingsOpen = ref(false);
const accountOpen = ref(false);
const settingsButton = ref<HTMLButtonElement>();
const focusTask = ref("");
const announcement = ref("");
const statusLabel = computed(
  () =>
    ({
      ready: "Ready",
      running: "Running",
      paused: "Paused",
      finished: "Finished",
    })[status.value],
);
const sessionLabel = computed(() =>
  activeSessionId.value === "long-rest"
    ? "Long rest"
    : activeSessionId.value.startsWith("rest")
      ? "Rest"
      : "Focus",
);
const isRest = computed(() => sessionLabel.value !== "Focus");
const modes = computed(() => {
  if (!sessions.value.length)
    return [{ label: "Focus", index: -1, active: true }];
  return ["Focus", "Rest", "Long rest"].flatMap((label) => {
    const index = sessions.value.findIndex((session) =>
      label === "Focus"
        ? session.countsAsFocus
        : label === "Rest"
          ? session.id.startsWith("rest")
          : session.id === "long-rest",
    );
    return index < 0
      ? []
      : [{ label, index, active: label === sessionLabel.value }];
  });
});
const sessionHint = computed(() =>
  status.value === "finished"
    ? "Well done. Reset when you’re ready for another round."
    : isRest.value
      ? "Step away. Breathe. This time is yours."
      : status.value === "paused"
        ? "Take your time. Pick up where you left off."
        : "One thing at a time. You’ve got this.",
);

function start() {
  if (settings.value.soundEnabled) void sound.unlock();
  announcement.value = "";
  timer.start();
}
function reset() {
  announcement.value = "";
  timer.reset();
}
function selectMode(index: number) {
  announcement.value = "";
  timer.selectSession(index);
}
function openSettings() {
  settingsOpen.value = true;
}
async function closeSettings() {
  settingsOpen.value = false;
  await nextTick();
  settingsButton.value?.focus();
}
function applySettings(next: Settings) {
  save(next);
  timer.configure(buildConfiguration(next));
  announcement.value = "Settings saved. Your new timer is ready.";
  void closeSettings();
}
watch(timer.completionCount, () => {
  const finished =
    timer.lastCompletedSession.value.startsWith("rest") ||
    timer.lastCompletedSession.value === "long-rest"
      ? "Rest"
      : "Focus";
  announcement.value = sessions.value.length
    ? `${finished} complete. ${sessionLabel.value} is ready when you are.`
    : "Focus complete. Nice work!";
  if (settings.value.soundEnabled) sound.play();
});
const previousTitle = document.title;
watch(
  [remainingSeconds, status, activeSessionId],
  () => {
    document.title = `${formatTime(remainingSeconds.value)} · ${sessionLabel.value} — Pomodoro`;
  },
  { immediate: true },
);
function onKeydown(event: KeyboardEvent) {
  if (
    settingsOpen.value ||
    accountOpen.value ||
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return;
  const target = event.target as HTMLElement | null;
  if (
    target?.closest(
      'input, textarea, select, button, a, [contenteditable="true"]',
    )
  )
    return;
  if (event.code === "Space") {
    event.preventDefault();
    if (isRunning.value) timer.pause();
    else start();
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    reset();
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  document.title = previousTitle;
});
</script>

<template>
  <div class="app-shell">
    <header class="header">
      <a class="brand" href="#timer" aria-label="Pomodoro timer"
        ><span class="palette" aria-hidden="true"><i /><i /><i /><i /></span
        ><span>pomodoro<span class="brand-dot">.</span></span></a
      >
      <div class="header-actions">
      <AccountMenu @dialog-change="accountOpen = $event" />
      <button
        ref="settingsButton"
        class="settings-button"
        data-testid="open-settings"
        @click="openSettings"
      >
        <span aria-hidden="true">⚙</span> Settings
      </button>
      </div>
    </header>
    <main id="timer" class="timer-page">
      <p class="eyebrow">A LITTLE TIME, WELL SPENT</p>
      <nav class="mode-switch" aria-label="Session type">
        <button
          v-for="mode in modes"
          :key="mode.label"
          :aria-pressed="mode.active"
          :class="{ active: mode.active }"
          :data-testid="`mode-${mode.label.toLowerCase().replace(' ', '-')}`"
          @click="selectMode(mode.index)"
        >
          {{ mode.label }}
        </button>
      </nav>
      <p
        class="timer-status"
        :class="status"
        data-testid="timer-status"
        aria-live="polite"
      >
        {{ statusLabel }}
      </p>
      <div
        class="timer-dial"
        :class="{ rest: isRest }"
        :style="{
          background: `conic-gradient(${isRest ? 'var(--color-blue)' : 'var(--color-teal)'} ${progress}%, var(--color-border) 0)`,
        }"
      >
        <div class="dial-content">
          <p class="session-label" data-testid="session-label">
            {{ sessionLabel }} session
          </p>
          <TimerDisplay :value="formatTime(remainingSeconds)" /><span
            class="duration-label"
            >{{ formatTime(timer.durationSeconds.value) }} total</span
          >
        </div>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="Session progress"
        :aria-valuenow="Math.round(progress)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${progress}%` }" />
      </div>
      <p class="session-hint">{{ sessionHint }}</p>
      <TimerControls
        :is-running="isRunning"
        :paused="status === 'paused'"
        :finished="status === 'finished'"
        @start="start"
        @pause="timer.pause"
        @reset="reset"
      />
      <p class="announcement" role="status" data-testid="completion-message">
        {{ announcement || "\u00a0" }}
      </p>
      <div class="session-details">
        <label class="task"
          ><span>WHAT’S YOUR ONE THING?</span
          ><input
            v-model="focusTask"
            maxlength="120"
            placeholder="Give this session a purpose…"
            aria-label="Focus task"
        /></label>
        <div class="completed">
          <strong data-testid="completed-count">{{
            completedFocusSessions
          }}</strong
          ><span
            >focus
            {{
              completedFocusSessions === 1 ? "session" : "sessions"
            }}
            completed<br /><small>this visit</small></span
          >
        </div>
      </div>
      <p v-if="storageMessage" class="storage-message" role="status">
        {{ storageMessage }}
      </p>
    </main>
    <footer>
      <span>Find your rhythm. Make room for rest.</span
      ><span class="shortcut"
        ><kbd>Space</kbd> start / pause <span>·</span> <kbd>R</kbd> reset</span
      >
    </footer>
    <TimerSettings
      v-if="settingsOpen"
      :settings="settings"
      @save="applySettings"
      @cancel="closeSettings"
    />
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  max-width: 72rem;
  margin: auto;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  padding: 0 2rem;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 2rem 0;
  flex-wrap: wrap;
}
.header-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }
.brand {
  color: var(--color-lime);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 1.2rem;
  font-weight: 650;
}
.brand-dot {
  color: var(--color-teal);
}
.palette {
  display: flex;
  i {
    width: 1.3rem;
    height: 1.3rem;
    border-radius: 50%;
    background: var(--color-lime);
    &:not(:first-child) {
      margin-left: -0.45rem;
    }
    &:nth-child(2) {
      background: var(--color-mint);
    }
    &:nth-child(3) {
      background: var(--color-teal);
    }
    &:nth-child(4) {
      background: var(--color-blue);
    }
  }
}
.settings-button {
  background: var(--color-surface);
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  padding: 0.65rem 1rem;
  border-radius: 0.7rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover {
    color: var(--color-lime);
  }
}
.timer-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0 2rem;
}
.eyebrow {
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: var(--color-muted);
  margin: 0 0 1.4rem;
}
.mode-switch {
  display: flex;
  padding: 0.3rem;
  border-radius: 1rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  gap: 0.2rem;
  button {
    border-radius: 0.7rem;
    padding: 0.55rem 1rem;
    background: transparent;
    color: var(--color-muted);
    font-size: 0.85rem;
    &.active {
      color: var(--color-background);
      background: var(--color-lime);
    }
  }
}
.timer-status {
  margin: 1.25rem 0 1rem;
  font-size: clamp(2.5rem, 10vw, 5rem);
  font-weight: 500;
  line-height: 1.1;
  &.running {
    color: var(--color-teal);
  }
  &.paused {
    color: var(--color-red);
  }
  &.finished {
    color: var(--color-mint);
  }
}
.timer-dial {
  width: min(100%, 23rem);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  position: relative;
  &::before {
    content: "";
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    background: var(--color-background);
  }
}
.dial-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
}
.session-label {
  font-size: 0.8rem;
  color: var(--color-mint);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}
.duration-label {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.progress-track {
  width: min(100%, 15rem);
  height: 3px;
  border-radius: 2px;
  background: var(--color-border);
  margin-top: 1rem;
  overflow: hidden;
  span {
    display: block;
    height: 100%;
    background: var(--color-teal);
  }
}
.session-hint {
  color: var(--color-muted);
  font-size: 0.85rem;
  text-align: center;
  margin: 1.25rem 0 1.5rem;
  line-height: 1.6;
}
.announcement {
  min-height: 1.4rem;
  text-align: center;
  color: var(--color-mint);
  font-size: 0.85rem;
  margin: 1.25rem 0;
}
.session-details {
  width: min(100%, 36rem);
  display: grid;
  grid-template-columns: 1fr auto;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  padding: 1.25rem;
  gap: 1.5rem;
  background: var(--color-surface);
}
.task {
  min-width: 0;
  span {
    display: block;
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: var(--color-muted);
    margin-bottom: 0.65rem;
  }
  input {
    width: 100%;
    background: transparent;
    color: var(--color-lime);
    border: 0;
    padding: 0.25rem 0;
    font-size: 0.85rem;
    &::placeholder {
      color: var(--color-muted);
    }
  }
}
.completed {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border-left: 1px solid var(--color-border);
  padding-left: 1.5rem;
  strong {
    font-size: 2rem;
    font-weight: 500;
    color: var(--color-mint);
  }
  span {
    font-size: 0.7rem;
    color: var(--color-muted);
    line-height: 1.5;
  }
  small {
    font-size: 0.65rem;
  }
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 0;
  color: var(--color-muted);
  font-size: 0.7rem;
  border-top: 1px solid var(--color-border);
}
.shortcut {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
kbd {
  font: inherit;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  padding: 0.15rem 0.3rem;
}
.storage-message {
  color: var(--color-red);
  font-size: 0.8rem;
  text-align: center;
}
@media (max-width: 480px) {
  .app-shell {
    padding: 0 1rem;
  }
  .header {
    padding: 1.25rem 0;
  }
  .timer-page {
    padding-top: 0.5rem;
  }
  .session-details {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .completed {
    border-left: 0;
    border-top: 1px solid var(--color-border);
    padding: 1rem 0 0;
  }
  footer {
    justify-content: center;
    text-align: center;
  }
  .shortcut {
    display: none;
  }
  .mode-switch button {
    padding: 0.55rem 0.7rem;
  }
}
</style>
