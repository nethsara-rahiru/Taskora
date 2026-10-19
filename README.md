# Taskora


## Schedule settings

In **Timetables & Schedules**, select a schedule and choose **Settings**.

- **Priority:** urgent, high, medium, or low; higher priorities appear first. Overlapping slots remain visible.
- **Start date / Follow through:** optional inclusive dates. Leave the end blank to repeat indefinitely.
- **Pause:** temporarily hide occurrences without deleting slots; uncheck it to resume.
- **Skip dates or weeks:** add a single date or an inclusive range. The whole-week shortcut skips Monday through Sunday. Remove a range to restore those occurrences.

Use the week arrows or **This week** to view dated occurrences. The dashboard excludes paused, skipped, and out-of-range slots. Existing schedules default to medium priority, no date limits, and no skips.

Run schedule rule tests with `node --test server/tests/schedule-rules.test.js`.
