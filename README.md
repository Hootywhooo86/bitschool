# bitschool — School, but chunkier.

The 128bit family's pixel school app. Landing page + working mock live at https://hootywhooo86.github.io/bitschool/

## What it is

A chunky, game-like school app for the 128bit family: a readable day timetable, homework as quests that pay XP into 128bitlife, grades at a glance, and streaks for showing up and getting work done. The mock on the landing page does all of that (with sample classes, assignments, and grades): switch days on the timetable, tap homework done, watch the quest bar move.

## bitschool Reading (`app/`)

A reading-only app in the same pixel family style. Open `app/index.html` (or https://hootywhooo86.github.io/bitschool/app/). No build step, no sign-in; everything stays on the device.

- **Placement test:** pick a grade, then read short built-in stories out loud and answer two questions after each. It adapts (up on a pass, down on a miss, then narrows in) and places him at the highest level he passed, usually in 4–6 stories.
- **80 levels, A-1 to H-10:** each step adds a little length (25 words at A-1, ~350 at H-10), sentence length, vocabulary and question difficulty. `js/levels.js` has the full spec.
- **Moving up like Kumon:** a story's score is 40% read-aloud accuracy plus 60% questions and tasks. Hit the pass mark (default 85%, adjustable) to move up one step; grown-ups can require 2–5 passes in a row.
- **Read-aloud check:** the app listens and follows along word by word (green = read, yellow = stumbled, red = skipped) and tracks words per minute. Each reading is recorded for the parent dashboard. Browsers without speech recognition (Firefox, some iPads) use **helper mode**, where a grown-up taps the words he misses.
- **Lesson flow:** warm-up words → read → questions (multiple choice + one open answer he can type, write with the stylus, or say) → circle/underline → fill in the blank → sentence order (drag) → score.
- **Vocabulary:** tap any word to hear it and see its meaning. Missed, skipped and looked-up words return in Word Review on a spaced schedule until learned.
- **Grown-ups dashboard** (behind a times-table question): reading-speed and accuracy charts, level history, problem words, recordings, handwritten answers to mark, and settings.
- **Colors:** six themes, or your own six colors (background, panels, buttons, highlights, text, apple), plus story text size.
- **Size rule:** the logo is a 128px pixel apple; every button, tile and icon is 128px or larger.

### Stories from a local model (Qwen)

Stories, open-answer checking and word meanings come from a model running on your own computer. Nothing goes to the internet.

1. Install [Ollama](https://ollama.com) and run `ollama pull qwen3:8b` (or `qwen2.5:7b` on a smaller machine).
2. Let the page reach it: start Ollama with `OLLAMA_ORIGINS=*` (Mac: `launchctl setenv OLLAMA_ORIGINS "*"`, then restart Ollama). For a tablet on the same Wi-Fi, also set `OLLAMA_HOST=0.0.0.0` and put the computer's address (e.g. `http://192.168.1.20:11434`) in Grown-ups → Settings.
3. Grown-ups → Settings → **SAVE & TEST**, then **WRITE A SAMPLE STORY** to check the level fits.

Each story is checked before he sees it (length within range of the level target, real questions, answer order shuffled). The app writes the next stories in the background. LM Studio and llama.cpp work too (choose "OpenAI-compatible"). Add a vision model such as `qwen2.5vl:7b` to have handwritten answers read; without one, they wait in **Check answers** for a grown-up. With the model off, the 16 built-in stories (two per letter, all original) are used.

### Known limits

- Speech recognition in Chrome and Edge goes through the browser maker's servers, and it is less accurate with young voices. Helper mode, and the recordings, are the backup. A fully offline option would be whisper.cpp behind the same local server.
- A 7–8B model sometimes misses the target length or writes a weak question. The length check and retry catch most of it; use the sample-story preview when trying a new model.
- Progress lives in this browser's storage. Use Export in Settings to back it up. Events (`reading.session`, `level.up`, `placement.done`) are queued for the shared family feed but not sent yet.

### Windows .exe and Android .apk (`native/`)

`native/` wraps the same `app/` folder: Electron for Windows, Capacitor for Android.

- **Windows:** `bitschool-Reading-Setup-1.0.0.exe` installs it with a Start-menu shortcut; `bitschool-Reading-1.0.0-portable.exe` runs without installing. They are not code-signed, so Windows SmartScreen shows "Windows protected your PC" → **More info → Run anyway**. Windows has no speech recognition inside Electron, so reading uses grown-up helper mode (a grown-up taps missed words). Recordings, read-to-me voices and everything else work.
- **Android:** `bitschool-Reading-1.0.0.apk` (Android 7+). Install it by opening the file on the phone and allowing "install unknown apps". It uses the phone's own speech recognizer, so the app follows along as he reads, and the phone's voice for "hear it". The recognizer and the recorder can't share the microphone, so in app-listens mode there's no recording; helper mode still records. This is a debug-signed build for sideloading; Play Store release needs a signing key.
- **Story writer from a phone:** the model runs on a computer, not the phone. Start Ollama with `OLLAMA_HOST=0.0.0.0` and enter the computer's address (e.g. `http://192.168.1.20:11434`) in Grown-ups → Settings.

To rebuild (Node 20+; the .exe also needs Wine on Linux/macOS; the .apk needs JDK 21 and the Android SDK with platform 36):

```
cd native
npm install
npm run exe   # → native/dist/*.exe
npm run apk   # → native/android/app/build/outputs/apk/debug/app-debug.apk
```

Run `npm start` to try the desktop version, and `node scripts/make-icons.js` (needs Playwright) after changing the apple to redraw the Android icons.

## Relationship to bitcalendar and 128bitlife

bitcalendar is the family calendar (events, plans, reminders). bitschool is school-specific: timetables, assignments, grades. School deadlines can flow into bitcalendar, and homework quests pay XP into 128bitlife — school is one more quest source in the family game, not a separate silo.

## Architecture

- One 128bit account + the shared family event feed (`supabase/family-feed.sql` — same `family_events` schema as the rest of the family). School emits `homework.done` / `grade.posted` / `streak.milestone` events so quests, the family timeline, and bitcalendar can subscribe.
- Landing page is a static mock only; the real app build is Carlos's lane (see below).

## Open product questions (Daniel's call)

- **Where does the data come from?** Manual entry, or sync with a school system (Google Classroom, PowerSchool, etc.)? (Rocky recommends manual-first — sync is a permissions and privacy minefield.)
- **Who's it for?** Students only, or a family view where parents see what's due and done?
- **Subjects and levels:** K-12 only, or college too? Fixed subject list or custom?
- **Grades:** manual grade entry, or imported? Grade trends and predictions in v1?
- **Privacy:** student data is sensitive — what stays on-device vs syncs to the family feed?
- **Platform:** iOS/Android/both, native build or wrapped web app?

## Status

- Landing page + mock: live.
- bitschool Reading (`app/`, plus Windows .exe and Android .apk from `native/`): working build: placement test, 80 levels, read-aloud, tasks, dashboard, local-model stories.
- Real app build: not started. Formspree ID still needed in the waitlist form (`YOUR_FORM_ID` placeholder with a local-confirm fallback).
