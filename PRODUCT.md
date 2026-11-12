# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person, the owner: Mehdi, starting from a very sedentary profile (1.75 m, 70 kg, significant visceral fat, smoker). He trains five times a week in a commercial gym and uses the app mostly there, between sets: phone held in one hand under gym lighting, often with sweaty hands and a short attention window. He also fills a short check-in in the evening.

## Product Purpose

Athletics helps him stay consistent through a six-month physical transformation: lose fat (especially abdominal), build visible muscle, gain strength and endurance. Success is regularity over six months, not peak performance: sessions done, check-ins filled, measurements logged weekly.

## Positioning

A private, offline, single-user training companion: no account, no server, no social layer, no coaching voice. It knows his own programme (Push / Pull / Legs / Upper / Lower on Tuesday, Wednesday, Thursday, Saturday, Sunday), proposes the next load from his own history, and reports facts without judgement.

## Operating Context

- Installed from Safari to the iPhone home screen (PWA), works fully offline.
- In the gym: open today's session, log load and reps per set, run the rest timer, replace an exercise when a machine is taken, finish the session.
- Evening: daily check-in in under 30 seconds (session, sleep, meals, cigarettes).
- Weekly: weight and waist measurement, weekly review, JSON export as backup.
- Reminders come from the iPhone Reminders app (18:00 session, 21:00 check-in).

## Capabilities and Constraints

- Daily check-in: session done / not done / rest, bedtime and wake time with computed sleep, quality 1–5, balanced meals, snacking, sugary drinks, notes, cigarettes counter.
- Programme: editable sessions with day, exercises (sets, reps or seconds or minutes, load, rest, instruction), a six-month three-phase plan with deload weeks 8, 16, 24.
- Session mode: prefilled loads, double-progression suggestion (+2.5 kg), rest timer, exercise replacement, records and estimated max.
- Body tracking: weight and waist, six-month charts with target date and trend.
- Weekly review, monthly consistency calendar, JSON export and import.
- Plain HTML, CSS and JavaScript ES modules, IndexedDB, service worker; no framework, no build step, no third-party service at runtime. Must stay compatible with recent iOS Safari.
- Every existing function, data format and stored data must survive the redesign.

## Brand Commitments

- Name: Athletics. Interface language: French.
- Tone: neutral and encouraging, never guilt-inducing, even after missed days. No imposed diet, calories or medical advice; nutrition goals are only what he sets himself.
- For the redesign the owner explicitly opened everything else: dark theme, button size and one-handed layout are no longer binding (functions and data are).

## Evidence on Hand

No real photography, logos or testimonials. Real data only comes from his own use; demonstration data in screenshots must be labelled as such.

## Product Principles

1. Consistency over intensity: every screen makes the next small action obvious.
2. Facts without judgement: numbers are shown plainly, encouragement only comes from real facts.
3. Built for the gym moment: readable at a glance, operable with one thumb between sets.
4. Private by construction: everything stays on the phone.

## Accessibility & Inclusion

Large touch targets and high contrast under bright gym lighting; information never carried by colour alone.
