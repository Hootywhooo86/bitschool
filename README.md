# bitschool — School, but chunkier.

The 128bit family's pixel school app. Landing page + working mock live at https://hootywhooo86.github.io/bitschool/

## What it is

A chunky, game-like school app for the 128bit family: a readable day timetable, homework as quests that pay XP into 128bitlife, grades at a glance, and streaks for showing up and getting work done. The mock on the landing page does all of that (with sample classes, assignments, and grades): switch days on the timetable, tap homework done, watch the quest bar move.

## bitschool Reading (`app/`)

A reading-only app in the same pixel family style. Open `app/index.html` (or https://hootywhooo86.github.io/bitschool/app/). No build step, no sign-in; everything stays on the device.

- **Placement test:** pick a grade, then read short built-in stories out loud and answer two questions after each. It adapts (up on a pass, down on a miss, then narrows in) and places him at the highest level he passed, usually in 4–6 stories.
- **80 levels, A-1 to H-10:** each step adds a little length (25 words at A-1, ~350 at H-10), sentence length, vocabulary and question difficulty. `js/levels.js` has the full spec.
- **Booklets, like Kumon:** each level is a booklet of numbered sheets (6 by default, 2–10 in Settings) that alternate **Word Work** and **Story** sheets. A sheet passes at the pass mark (default 85%); one below it comes back until it passes, and passing every sheet in the booklet moves him up one level.
- **Word Work sheets:** six interactive exercises from a curated word bank (8 bands, written by hand so every answer is right), matched to his level: first sounds, rhymes and missing letters (A–C); hear-it-spell-it, word meanings, match words to meanings, and build a sentence from word tiles (all levels); punctuation and capital letters (B–E); nouns/verbs/adjectives, plurals, past tense (C–F); synonyms, opposites, compound words, contractions (D–H); context clues, prefixes and suffixes, fact or opinion, similes and metaphors (E–H); and writing his own sentence (C–H). He taps, types, matches, drags tiles, or says it out loud.
- **He picks the story:** before each Story sheet he chooses a theme tile (superheroes, missions, space bugs, space, robots, dinosaurs, sports, knights and dragons), one of the ideas a grown-up added in Settings (a hero, game or show he loves), types or says his own idea, or taps Surprise Me. Stories stay cartoon-safe: action is fine, but no blood, nobody dies, no swearing; a story that slips past the prompt is caught by a word filter and rewritten. Stories about his last pick are written ahead in the background.
- **Daily goal and streak:** a daily goal (2 sheets by default, 1–6 in Settings), a day-streak counter and a two-week star calendar on the home screen, with a celebration when the goal is met. Changing the goal never erases days already earned.
- **Sheet timer:** a running clock on every sheet like Kumon's, the time on the results screen ("faster than last time!"), and a Time column on the dashboard.
- **Worksheets tile:** extra Word Work any time, either a mixed sheet or one skill (rhymes, plurals, punctuation…) from his level. Practice counts toward the daily goal but doesn't change the booklet.
- **Story sheets:** warm-up words → read → questions (multiple choice + one open answer he can type, write with the stylus, or say) → circle/underline → fill in the blank → sentence order (drag) → score.
- **Vocabulary:** tap any word to hear it and see its meaning. Missed, skipped and looked-up words return in Word Review on a spaced schedule until learned.
- **Grown-ups dashboard** (behind a times-table question): reading-speed and accuracy charts, level history, problem words, recordings, handwritten answers to mark, and settings.
- **Colors:** six themes, or your own six colors (background, panels, buttons, highlights, text, apple), plus story text size.
- **Size rule:** the logo is a 128px pixel apple; every button, tile and icon is 128px or larger.

### Stories from a model on the device (Qwen)

Stories, open-answer checking and word meanings come from an AI model that runs on your own device. Nothing goes to the internet except the one-time model download.

**In the Android and Windows apps:** Grown-ups → Settings → Story writer → **On this device**, then **Download** a model. It downloads from Hugging Face with a progress bar (stop and resume work), checks free space and memory, and starts writing stories for the current level. The app marks the one that fits the device:

| Model | Download | Memory | Best for |
|---|---|---|---|
| **Qwen3.5 2B** | 1.3 GB | about 4 GB | Phones and tablets |
| **Qwen3.5 4B** | 2.7 GB | about 8 GB | Windows PCs and tablets with 8 GB or more; noticeably better stories |

Why these: on the app's own prompt and checks at three levels (A-5, C-5, F-5), Qwen3.5 2B and 4B wrote usable stories at the right reading level. Gemma 4 E2B wrote smoother prose but pitched a 4th-grade story at grade 9 and is a 3.1 GB download; Gemma 3 1B broke the format (once writing questions in Spanish); Qwen3.5 0.8B wrote answer keys that contradicted its own stories.

On a 4-core test machine (no GPU) a story took about 1–1.5 minutes with the 2B and 1.5–3 minutes with the 4B. The app writes the next stories in the background, so a child usually doesn't wait. Windows uses the graphics card through Vulkan when it can.

**From a website browser, or to use a bigger model:** choose **On a computer (Ollama)**. Install [Ollama](https://ollama.com), run `ollama pull qwen3.5:4b` (or `qwen3.5:9b`), start it with `OLLAMA_ORIGINS=*`, and for a phone on the same Wi-Fi also `OLLAMA_HOST=0.0.0.0` with the computer's address (e.g. `http://192.168.1.20:11434`) in Settings. LM Studio and llama.cpp work too (choose "OpenAI-compatible"). A vision model can read handwritten answers; without one they wait in **Check answers** for a grown-up.

Every story is checked before he sees it: the right length, a reading level not far above his level (Flesch-Kincaid), real questions whose answers are in the passage, vocabulary words that appear in the story, and nothing copied from the instructions. A story that fails is rewritten once; after that the 16 built-in stories (two per letter, all original) are used.

### Known limits

- Speech recognition in Chrome and Edge goes through the browser maker's servers, and it is less accurate with young voices. Helper mode, and the recordings, are the backup. A fully offline option would be whisper.cpp behind the same local server.
- Small models still slip sometimes (a detail that doesn't fit, a weak question). The checks and retry catch length, level and format problems, not every odd sentence; use **Write a sample story** in Settings to see what a model writes.
- Progress lives in this browser's storage. Use Export in Settings to back it up. Events (`reading.session`, `level.up`, `placement.done`) are queued for the shared family feed but not sent yet.

### Windows .exe and Android .apk (`native/`)

`native/` wraps the same `app/` folder: Electron for Windows, Capacitor for Android.

- **Windows:** `bitschool-Reading-Setup-1.3.0.exe` installs it with a Start-menu shortcut; `bitschool-Reading-1.3.0-portable.exe` runs without installing. They are not code-signed, so Windows SmartScreen shows "Windows protected your PC" → **More info → Run anyway**. Windows has no speech recognition inside Electron, so reading uses grown-up helper mode (a grown-up taps missed words). Recordings, read-to-me voices and everything else work.
- **Android:** `bitschool-Reading-1.3.0.apk` (Android 7+, 64-bit phones and tablets — nearly every one made since 2017). Install it by opening the file on the phone and allowing "install unknown apps". It uses the phone's own speech recognizer, so the app follows along as he reads, and the phone's voice for "hear it". The recognizer and the recorder can't share the microphone, so in app-listens mode there's no recording; helper mode still records. This is a debug-signed build for sideloading; Play Store release needs a signing key.
- **On-device story writer:** Android runs llama.cpp through a small Capacitor plugin (`android/app/src/main/cpp`, `LocalLlmPlugin.java`), built for 64-bit ARM with a CPU variant picked per phone. Windows runs node-llama-cpp in the Electron main process (`electron/llm.js`) with CPU and Vulkan builds. Both render the model's own chat template with thinking off and force the story's JSON shape with a grammar.

To rebuild (Node 20+; the .exe also needs Wine on Linux/macOS; the .apk needs JDK 21, git, and the Android SDK with platform 36, NDK 28.2 and CMake 3.31). The Android build compiles the llama.cpp source that ships inside the node-llama-cpp npm package; `npm run apk` unpacks it to `native/.llama.cpp` (not committed):

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
