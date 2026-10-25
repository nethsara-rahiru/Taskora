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

## Groq AI assistant

Requires Node.js 18+ and outbound HTTPS access to `api.groq.com`.

1. Set a stable random `AI_ENCRYPTION_KEY` (32+ characters) in the server's `.env` and restart Taskora. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it backed up: changing it requires saving Groq keys again. An explicitly configured, non-default `JWT_SECRET` of at least 32 characters is also supported as a fallback.
2. Open **Settings → Groq AI**, add your Groq key, enable AI, choose a model, timezone, working hours, and default task duration. Save, then **Test connection**. Keys are encrypted in MongoDB, excluded from user/profile responses, and never sent back to the browser. Blank key input keeps the existing key; **Remove key** deletes it and disables AI.
3. Open **AI Assistant** from the sidebar or the ✦ shortcut. Use **Quick add** for natural-language tasks/events, **Schedule existing tasks** for placements, or **Suggestions & recommendations** for advice. Calendar date popups also link to the assistant with that date selected.
4. Review the proposed titles, dates, times, and priorities. Edit them if necessary, then apply individual proposals. Generation never changes tasks automatically. Proposals expire after an hour; saved proposals cannot create duplicate tasks when retried. Availability is rechecked at save time against tasks, events, and active timetable slots, including pause/end/skip rules.

Planning uses seven days from the selected date, up to 100 active tasks as model context, and at most eight proposals per request. Task placements reserve the default duration without adding end times to tasks. Events require same-day start/end times. Existing events are treated as fixed commitments. Requests and the relevant task/schedule context are shared with Groq only when generating suggestions; no Groq key or full account profile is included in the model prompt. AI output can be wrong, so drafts remain editable and require an individual save.

Groq authentication failures, rate limits, timeouts, malformed output, scheduling conflicts, and tasks changed since generation produce actionable errors. The integration uses Groq's OpenAI-compatible chat endpoint with JSON mode; a live connection requires your own Groq key.

Run feature tests with `node --test server/tests/ai-validation.test.js server/tests/ai-key.test.js server/tests/ai-apply.test.js`.
