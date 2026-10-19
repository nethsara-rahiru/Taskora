# Taskora


## Schedule settings

In **Timetables & Schedules**, select a schedule and choose **Settings**.

- **Priority:** urgent, high, medium, or low; higher priorities appear first. Overlapping slots remain visible.
- **Start date / Follow through:** optional inclusive dates. Leave the end blank to repeat indefinitely.
- **Pause:** temporarily hide occurrences without deleting slots; uncheck it to resume.
- **Skip dates or weeks:** add a single date or an inclusive range. The whole-week shortcut skips Monday through Sunday. Remove a range to restore those occurrences.

Use the week arrows or **This week** to view dated occurrences. The dashboard excludes paused, skipped, and out-of-range slots. Existing schedules default to medium priority, no date limits, and no skips.

Run schedule rule tests with `node --test server/tests/schedule-rules.test.js`.

## Events

Choose **Event** in the task popup, then set a date, start time, and either an end time or a duration in minutes. Events currently end on the same day. Tasks only have a due time.

Saved events appear in the **Events** tab of Timetables & Schedules in their dated week, including early-morning and late-night events. Edit older events to supply the correct end time if needed.

Run event timing tests with `node --test server/tests/event-timing.test.js`.
