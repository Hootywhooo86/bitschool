# bitschool — School, but chunkier.

The 128bit family's pixel school app. Landing page + working mock live at https://hootywhooo86.github.io/bitschool/

## What it is

A chunky, game-like school app for the 128bit family: a readable day timetable, homework as quests that pay XP into 128bitlife, grades at a glance, and streaks for showing up and getting work done. The mock on the landing page does all of that (with sample classes, assignments, and grades): switch days on the timetable, tap homework done, watch the quest bar move.

## bitschool Reading (`app/`)

A reading-only app in the same pixel family style. Open `app/index.html` (or https://hootywhooo86.github.io/bitschool/app/). No build step. Progress stays on the device, and also saves to the 128bit family account once a grown-up signs in.

- **Placement test:** pick a grade, then read short built-in stories out loud and answer two questions after each. It adapts (up on a pass, down on a miss, then narrows in) and places him at the highest level he passed, usually in 4–6 stories.
- **80 levels, A-1 to H-10:** each step adds a little length (25 words at A-1, ~350 at H-10), sentence length, vocabulary and question difficulty. `js/levels.js` has the full spec.
- **Booklets, like Kumon:** each level is a booklet of numbered sheets (6 by default, 2–10 in Settings) that alternate **Word Work** and **Story** sheets. A sheet passes at the pass mark (default 85%); one below it comes back until it passes, and passing every sheet in the booklet moves him up one level.
- **Word Work sheets:** six interactive exercises from a curated word bank (8 bands, written by hand so every answer is right), matched to his level: first sounds, rhymes and missing letters (A–C); hear-it-spell-it, word meanings, match words to meanings, and build a sentence from word tiles (all levels); punctuation and capital letters (B–E); nouns/verbs/adjectives, plurals, past tense (C–F); synonyms, opposites, compound words, contractions (D–H); context clues, prefixes and suffixes, fact or opinion, similes and metaphors (E–H); and writing his own sentence (C–H). He taps, types, matches, drags tiles, or says it out loud.
- **He picks the story:** before each Story sheet he chooses a theme tile (superheroes, missions, space bugs, space, robots, dinosaurs, sports, knights and dragons), one of the ideas a grown-up added in Settings (a hero, game or show he loves), types or says his own idea, or taps Surprise Me. Stories stay cartoon-safe: action is fine, but no blood, nobody dies, no swearing; a story that slips past the prompt is caught by a word filter and rewritten. Stories about his last pick are written ahead in the background.
- **Reading voice:** the most natural-sounding English voice on the device is picked automatically; Settings has a voice list, a sample button and a speed control.
- **Daily goal and streak:** a daily goal (2 sheets by default, 1–6 in Settings), a day-streak counter and a two-week star calendar on the home screen, with a celebration when the goal is met. Changing the goal never erases days already earned.
- **Sheet timer:** a running clock on every sheet like Kumon's, the time on the results screen ("faster than last time!"), and a Time column on the dashboard.
- **Worksheets tile:** extra Word Work any time, either a mixed sheet or one skill (rhymes, plurals, punctuation…) from his level. Practice counts toward the daily goal but doesn't change the booklet.
- **Story sheets:** warm-up words → read → questions (multiple choice + one open answer he can type, write with the stylus, or say) → circle/underline → fill in the blank → sentence order (drag) → score.
- **Read-aloud check:** the app listens and follows along word by word (green = read, yellow = stumbled, red = skipped, dotted = the app didn't hear it) and tracks words per minute. On Android it uses its own listener (`native/android/.../ListenPlugin.java`) that keeps the phone's recognizer running through pauses: instant restarts, long silence timeouts, the restart beep muted, and the screen kept on. Listening only stops when he taps I'M DONE; reaching the last word just reminds him. If the recognizer drops a stretch, the app finds his place again further on; missed words don't count against him, and a grown-up can mark them read with one tap or fix single words. Each reading is recorded for the dashboard (on Android, in grown-up helper mode, since the recognizer and recorder can't share the microphone). Windows has no recognizer, so it uses helper mode: a grown-up taps the words he misses.
- **Whisper listening (Android):** Grown-ups → Settings → Listening downloads Whisper (base.en 82 MB, or tiny.en 44 MB for older phones) and runs it on the phone (`WhisperPlugin.java`, `whisper_engine.cpp`, whisper.cpp from the whisper.rn npm package). The app records the microphone itself, so nothing is lost between pauses and every reading is kept as a recording. Whisper is given the part of the story he's reading as a hint. On test recordings with a child-like voice, long pauses and background noise, it heard 92–95% of the story, against 67–80% without the hint. When he taps I'M DONE it makes a final careful pass over his last words before scoring.
- **Smarter word matching:** sound-alikes (read/red, there/their, knight/night), contractions said in full ("did not"), words joined or split ("sun flower"), and re-reading a phrase all count as reading. On Android 13+ the phone's listener is also told the story's words.
- **How stories are written:** Settings → How stories are written: instructions for the story writer ("make it funny, put our dog Max in it"), his name as the hero, shorter or longer stories, and words to practice. Before he reads, ✎ CHANGE THIS STORY rewrites it with a note, swaps in a different one, or lets a grown-up edit the words. The picker also takes a grown-up's own typed story, and the writer adds its questions.
- **Story Time:** a home tile for reading any story, any time, outside the booklet. It counts toward the daily goal.
- **Vocabulary:** tap any word to hear it and see its meaning. Missed, skipped and looked-up words return in Word Review on a spaced schedule until learned.
- **Saved to the 128bit family account:** Grown-ups → Settings → 128bit family account, signed in with the same email and password as 128bit Play. Progress (level, booklet, scores, streak, words, story ideas, settings) saves automatically a few seconds after each change, when going offline→online, and when the app is closed, using the project's existing `get_settings` / `put_settings` functions under the app key `bitschool-reading`. A new device or reinstall gets it back on sign-in. If two devices both made progress, saving merges them (every sheet kept, the higher level kept) instead of overwriting. Events (`worksheet.done`, `reading.session`, `level.up`, `placement.done`) go to the shared family feed via `log_events`. Recordings, handwriting pictures, stories written ahead, and the downloaded story writer stay on each device. "Reset everything" signs out first, so it never erases the account copy. No database changes were needed.
- **Grown-ups dashboard** (behind a times-table question): reading-speed and accuracy charts, level history, problem words, recordings, handwritten answers to mark, and settings.
- **Colors:** six themes, or your own six colors (background, panels, buttons, highlights, text, apple), plus story text size.
- **Animations:** screens slide in; buttons and tiles squish; the apple bounces and a pencil scribbles while a story is written, with a bar that fills; a new story opens like a page turning; each word he reads pops green and leaves a star; a right answer bursts stars with a "+1", a wrong one wobbles; the score stars pop in; a passed sheet gets a MASTERED stamp; a level up grows the apple, slides in the new level and rains stars and apples; the streak flame flickers and grows with the streak; goal stars pop in day by day; and a worm peeks out of the home apple now and then. Grown-ups → Settings → Reader → ANIMATIONS turns them off, and they stay off when the device is set to reduce motion. Everything that moves is a 128px pixel icon.
- **Size rule:** the logo is a 128px pixel apple; every button, tile and icon is 128px or larger.

### The story writer

Stories, open-answer checking and word meanings come from an AI model. Grown-ups → Settings → Story writer has three choices: **On this device** (Qwen, downloaded once), **Cloud AI** (fastest; needs internet and a key), or **On a computer (Ollama)**.

**Why it's faster now (1.7.0):**
- **The shelf.** Stories are written ahead: one for each of his three favorite kinds of story at his level, one for SURPRISE ME, and one for the next level. That's five favorites while the device is charging, and only one on a low battery. Writing ahead also runs during Word Work. A picker tile that says "Ready now!" opens straight away.
- **He reads while the questions are written.** A story is written in two steps: the story, then (as a follow-up turn) its questions, words and circle task. He starts reading after the first step. If the questions aren't done when he gets there, he sees "Getting your questions ready…".
- **The phone doesn't read things twice.** For the questions step, the on-device engine carries on from the story it just wrote instead of reading the instructions and story again. Qwen3.5's memory can't be partly rewound, so re-reading was the only other way. On a 4-core test machine the questions started after 1.7 s instead of 4.9 s.
- **JSON on one line.** The grammar on the phone no longer lets the model write newlines and indentation between JSON values, which cut about a third of the tokens. On the same machine the story step went from 28 s to 18 s, and the whole sheet from about 65 s to 44 s.
- **Fixed, not rewritten.** A story that runs long is cut at the end of a sentence. Questions, words, or a circle sentence that don't fit the story are dropped, and if the questions fail completely he gets "What happened in this story?". A story that is rejected (too short, too hard, not kid-safe) is written again with the reason ("use shorter sentences and easier words"), up to three tries.
- **His pick comes first.** If the device is writing a shelf story he didn't pick, it stops so his story gets the processor. While Whisper listens to him read, story writing pauses so listening isn't slowed down.

### Cloud AI

Grown-ups → Settings → Story writer → **Cloud AI**. Choose **Claude** and a model: Claude Opus 5.5 (the best stories, about 5¢ a story), Claude Sonnet 5.5 (about 2¢), or Claude Haiku 5.5 (the fastest, well under 1¢). Then paste an API key from console.anthropic.com and press SAVE & TEST. **Other (OpenAI-compatible)** takes any service's address, model name and key. These prices are rough guesses for one story with its questions.

- A story comes back in seconds instead of a minute or two on a phone. Answer checking and word meanings use it too.
- Requests go straight from the app to the service (`api.anthropic.com` for Claude). They use structured JSON output, low effort, and a server-side fallback if a request is declined.
- The key is stored only on that device. It is not part of the progress saved to the 128bit account, and it's blanked in exported data. Each request contains his level, the topic he picked, the grown-up's story instructions, and his name only if "use his name" is on.
- Without internet, the story writer downloaded on the device takes over if there is one; otherwise the built-in stories are used.

### Stories from a model on the device (Qwen)

Nothing goes to the internet except the one-time model download.

**In the Android and Windows apps:** Grown-ups → Settings → Story writer → **On this device**, then **Download** a model. It downloads from Hugging Face with a progress bar (stop and resume work), checks free space and memory, and starts writing stories for the current level. The app marks the one that fits the device:

| Model | Download | Memory | Best for |
|---|---|---|---|
| **Qwen3.5 2B** | 1.3 GB | about 4 GB | Phones and tablets |
| **Qwen3.5 4B** | 2.7 GB | about 8 GB | Windows PCs and tablets with 8 GB or more; noticeably better stories |

Why these: on the app's own prompt and checks at three levels (A-5, C-5, F-5), Qwen3.5 2B and 4B wrote usable stories at the right reading level. Gemma 4 E2B wrote smoother prose but pitched a 4th-grade story at grade 9 and is a 3.1 GB download; Gemma 3 1B broke the format (once writing questions in Spanish); Qwen3.5 0.8B wrote answer keys that contradicted its own stories.

On a 4-core test machine (no GPU) with the 2B, the story step now takes about 20 s and its questions about 25 s more, while he reads. The 4B takes roughly twice as long. Phones vary; most are slower than that machine. The shelf means a child usually doesn't wait at all. Windows uses the graphics card through Vulkan when it can.

**From a website browser, or to use a bigger model:** choose **On a computer (Ollama)**. Install [Ollama](https://ollama.com), run `ollama pull qwen3.5:4b` (or `qwen3.5:9b`), start it with `OLLAMA_ORIGINS=*`, and for a phone on the same Wi-Fi also `OLLAMA_HOST=0.0.0.0` with the computer's address (e.g. `http://192.168.1.20:11434`) in Settings. LM Studio and llama.cpp work too (choose "OpenAI-compatible"). A vision model can read handwritten answers; without one they wait in **Check answers** for a grown-up.

Every story is checked before he sees it: the right length (cut at a sentence if it runs long), a reading level not far above his level (Flesch-Kincaid), kid-safe wording, real questions whose answers are in the passage, vocabulary words and circle sentences that appear in the story, and nothing copied from the instructions. A rejected story is written again with the reason, up to three tries; after that the 16 built-in stories (two per letter, all original) are used.

### Known limits

- Speech recognition in Chrome and Edge goes through the browser maker's servers, and it is less accurate with young voices. Helper mode, and the recordings, are the backup. A fully offline option would be whisper.cpp behind the same local server.
- Small models still slip sometimes (a detail that doesn't fit, a weak question). The checks and retry catch length, level and format problems, not every odd sentence; use **Write a sample story** in Settings to see what a model writes.
- Without signing in to the 128bit account, progress lives only in this device's storage; Export in Settings backs it up.
- The cloud AI is called straight from the app with the key on that device, which suits a family app. For a shared or public install, the key would belong on a server (for example a Supabase Edge Function on the 128bit project) instead.
- Calls to the cloud AI and the new animations were tested in headless Chromium with mocked replies, and the two-step writing with the real Qwen3.5 2B on a test machine, not yet on a real phone or Windows PC.

### Windows .exe and Android .apk (`native/`)

`native/` wraps the same `app/` folder: Electron for Windows, Capacitor for Android.

- **Windows:** `bitschool-Reading-Setup-1.6.1.exe` installs it with a Start-menu shortcut; `bitschool-Reading-1.6.1-portable.exe` runs without installing. They are not code-signed, so Windows SmartScreen shows "Windows protected your PC" → **More info → Run anyway**. Windows has no speech recognition inside Electron, so reading uses grown-up helper mode (a grown-up taps missed words). Recordings, read-to-me voices and everything else work.
- **Android:** `bitschool-Reading-1.6.1.apk` (Android 7+, 64-bit phones and tablets — nearly every one made since 2017). Install it by opening the file on the phone and allowing "install unknown apps". It uses the phone's own speech recognizer, so the app follows along as he reads, and the phone's voice for "hear it". The recognizer and the recorder can't share the microphone, so in app-listens mode there's no recording; helper mode still records. This is a debug-signed build for sideloading; Play Store release needs a signing key.
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
- bitschool Reading (`app/`, saves to the 128bit account, plus Windows .exe and Android .apk from `native/`): working build: placement test, 80 levels, read-aloud, tasks, dashboard, local-model stories.
- Real app build: not started. Formspree ID still needed in the waitlist form (`YOUR_FORM_ID` placeholder with a local-confirm fallback).
