# bitschool — School, but chunkier.

The 128bit family's pixel school app. Landing page + working mock live at https://hootywhooo86.github.io/bitschool/

## What it is

A chunky, game-like school app for the 128bit family: a readable day timetable, homework as quests that pay XP into 128bitlife, grades at a glance, and streaks for showing up and getting work done. The mock on the landing page does all of that (with sample classes, assignments, and grades): switch days on the timetable, tap homework done, watch the quest bar move.

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

- Landing page + mock: live (coming-soon).
- Real app build: not started. Formspree ID still needed in the waitlist form (`YOUR_FORM_ID` placeholder with a local-confirm fallback).
