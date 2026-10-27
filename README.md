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
3. Open **AI Assistant** from the sidebar or the ✦ shortcut. Use **Quick add** for natural-language tasks/events, **Plan / reschedule existing items** for placements, **Update a task, event or schedule** for edits, or **Suggestions & recommendations** for advice. Calendar date popups also link to the assistant with that date selected.
4. Review the proposed titles, dates, times, and priorities. Edit them if necessary, then apply individual proposals. Generation never changes tasks automatically. Proposals expire after an hour; saved proposals cannot create duplicate tasks when retried. Availability is rechecked at save time against tasks, events, and active timetable slots, including pause/end/skip rules.

Planning uses seven days from the selected date, up to 30 active tasks as model context, and at most eight proposals per request. Task placements reserve the default duration without adding end times to tasks. Events require same-day start/end times. Existing events are treated as commitments unless you explicitly request an event update. Requests and the relevant task/schedule context are shared with Groq only when generating suggestions; no Groq key or full account profile is included in the model prompt. AI output can be wrong, so drafts remain editable and require an individual save.

Groq authentication failures, rate limits, timeouts, malformed output, scheduling conflicts, and tasks changed since generation produce actionable errors. The integration uses Groq's OpenAI-compatible chat endpoint with strict JSON Schema structured outputs; a live connection requires your own Groq key.

Run feature tests with `node --test server/tests/ai-validation.test.js server/tests/ai-key.test.js server/tests/ai-apply.test.js`.

Supported Groq models: `openai/gpt-oss-20b` (default), `openai/gpt-oss-120b`, and `qwen/qwen3.8-27b`. Legacy Llama settings fall back to GPT OSS 20B; save Settings to persist your preferred model. Model access and rate limits depend on your Groq account. Provider errors now include the HTTP status, model, provider error code/message, and retry delay when supplied, with API keys redacted. See [models](https://console.groq.com/docs/models), [structured outputs](https://console.groq.com/docs/structured-outputs), and [rate limits](https://console.groq.com/docs/rate-limits).

To reduce token-rate pressure, planning context uses 30 active tasks, short descriptions, and merged busy windows. Full server-side conflict checks still use the original occupied intervals. Groq also enforces account-specific requests-per-minute and tokens-per-minute/day limits; changing models does not necessarily increase those limits.

### Updating existing items with AI

Choose **Update a task, event or schedule**, then select an exact item in **Update a specific item**. Each request reads its latest details from the database.

- Tasks: edit title, description, priority, date, or time; metadata-only edits can leave a task unscheduled.
- Events: change title, description, priority, date, start time, and end time, preserving the existing event record.
- Schedules: change title, description, priority, start/end dates, pause/resume, and skipped dates/ranges. Existing weekly slots stay intact.
- Weekly slots: change subject, weekday, start/end times, location, or organizer. This edits the recurring template for all active weeks, with conflict checks covering the selected planning week.

Selecting a schedule also allows proposals for its own slots. Review current details and proposed fields before applying. Multiple slot proposals for the same schedule can be applied in sequence; external changes still invalidate stale proposals. Schedule and slot creation/deletion are not AI operations.

For automatic targeting the model sees up to three schedules with ten slots each; selecting a schedule includes up to thirty slots, and selecting a particular slot always includes that slot. Task/event selections include the exact selected active record even if it falls outside the usual context limit.


## Dashboard daily advice

The dashboard generates daily advice automatically when Groq AI is enabled and configured. It uses the existing task/event/schedule context, timezone and working hours, and suggests focus blocks, breaks and priorities without changing entries. Advice is cached in this browser per account and calendar day in the AI timezone. **Refresh advice** uses the latest commitments; its timestamp shows when it was generated. Disabled or unconfigured AI shows a link to AI settings instead.

## Weather

Open **Settings → Location & weather planning**, search for a city or use device location, then **Save location**. This default is saved to your account and used by the Weather page and new AI requests across devices. **Remove saved location** stops weather being included in AI requests. Device location requires browser permission and HTTPS outside localhost. You can also preview another city in **Weather**; previews are remembered in this browser and do not overwrite the account default. Current conditions, the next 12 hours and a seven-day forecast use the location's timezone; units are Celsius and km/h. The visible page refreshes every 15 minutes, with a manual refresh button. Provider failures retain the previous forecast with a message and its conditions timestamp.

The server needs outbound HTTPS to `api.open-meteo.com` and `geocoding-api.open-meteo.com`. No additional key or database migration is needed. The integration uses Open-Meteo's public non-commercial API; see [Open-Meteo terms](https://open-meteo.com/en/terms). Weather endpoints require a Taskora session, validate locations and cache forecasts for ten minutes. The selected coordinates are sent to Open-Meteo through the server when fetching forecasts. AI receives the location name and a compact forecast, without raw coordinates. If weather is unavailable or outside forecast coverage, planning continues without weather claims.

Run weather tests with `node --test server/tests/weather.test.js`.


Daily advice and assistant plans prioritize achievable progress based on unfinished workload, urgency, estimated effort and real gaps around commitments. Preferred focus hours are guidance rather than a hard cutoff. Suggestions should be motivating and concise while preserving sleep, breaks, meals and recovery. Task effort uses the default duration as an estimate, not a known completion time. Plans consider the saved-location forecast for weather-sensitive tasks and travel; fixed commitments still require an explicit request before being moved.

Saved locations require no migration. They are optional, validated and scoped to the signed-in account. New daily advice uses a separate cache for each saved coordinate pair. Run location validation tests with `node --test server/tests/weather-location.test.js`.


## AI Memory

Open **AI Assistant → AI Memory** to add, edit or delete notes about preferences, lifestyle, tasks/goals or personal context. Save up to 30 notes of 400 characters each. Notes belong to the signed-in account and persist across devices. New dashboard advice and all assistant planning modes include them; the dashboard cache changes when memory is edited.

**Let AI remember useful details I share in requests** is enabled by default and can be switched off. With it enabled, assistant requests run a separate small Groq extraction alongside generation, adding up to three distinct lasting facts explicitly shared in the request. AI-added notes are labeled; AI does not automatically overwrite or delete notes. Disabling learning keeps existing memories available to suggestions. Dashboard prompts never teach memories, and generated advice, weather and task titles are not treated as new personal facts. Memory extraction can fail without failing the plan. It uses an additional provider request and an eight-second timeout.

Notes are included in Groq requests as contextual data. The current request and user-entered notes take priority over older AI-added notes; memories do not grant permission to alter tasks. Memory API routes require an authenticated account, enforce limits and validate contents. Optimistic revision checks preserve concurrent manual edits and prevent learning from restoring notes removed while generation was in progress. Raw notes are excluded from general profile responses and the browser's generic API cache; editing memory requires a connection. Saved memories are embedded in the user document, so existing accounts need no migration.

Run memory tests with `node --test server/tests/ai-memory.test.js server/tests/ai-advice.test.js server/tests/groq-request.test.js`.


## Weather timeline

The Weather page includes an interactive 24-hour condition graph. Time runs along the horizontal axis in the forecast location's timezone, with dates shown when the timeline crosses midnight. The center line is normal sunny weather, hotter clear daytime hours rise into red, and clouds/rain fall into blue. Hover or tap the graph, or use the **Explore an hour** slider (including arrow keys), to read actual conditions, temperature and rain chance. Small screens can scroll the graph horizontally.

This is an illustrative relative condition scale, not a physical weather measurement or a temperature axis. Clear daytime hours at or below 28°C sit at zero; heat above 28°C raises the line, while cloud and precipitation codes lower it. Nighttime clear skies stay neutral, and missing/unknown condition codes leave gaps rather than invented values. The graph uses up to 25 hourly samples from the current hour, covering 24 hours. Run its tests with `node --test server/tests/weather-chart.test.js`.
