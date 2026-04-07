# Google Workspace Integration

This app can use a Google Workspace bot account for Calendar events and Gmail notifications while keeping EMS/Neon as the source of truth.

## Production environment variables

Required for OAuth setup and runtime use:

```env
GOOGLE_WORKSPACE_CLIENT_ID=
GOOGLE_WORKSPACE_CLIENT_SECRET=
GOOGLE_WORKSPACE_REFRESH_TOKEN=
GOOGLE_WORKSPACE_BOT_EMAIL=internal@draganvlah.com
GOOGLE_WORKSPACE_CALENDAR_ID=c_5f35dbee085585ae9042314882faca52feed47cef99d645a9d20f7c355474481@group.calendar.google.com
GOOGLE_WORKSPACE_EMAIL_ENABLED=true
GOOGLE_WORKSPACE_CALENDAR_ENABLED=true
GOOGLE_WORKSPACE_TASK_CALENDAR_ENABLED=true
```

Never commit real Google secrets or refresh tokens.

## OAuth setup flow

1. Add `GOOGLE_WORKSPACE_CLIENT_ID` and `GOOGLE_WORKSPACE_CLIENT_SECRET` to Vercel Production env.
2. Confirm the OAuth client has this redirect URI:
   - `https://employer.dashboard.vlahenterpriseapp.com/api/google/oauth/callback`
3. Log in to EMS as an admin.
4. Open:
   - `https://employer.dashboard.vlahenterpriseapp.com/api/google/oauth/start`
5. Approve Calendar/Gmail access as the bot account.
6. Copy the refresh token from the callback page.
7. Add it to Vercel as `GOOGLE_WORKSPACE_REFRESH_TOKEN`.
8. Redeploy production.

## What syncs today

- Approved absences create/update an all-day blocker event in the configured Google Calendar.
- Rejected/cancelled absences delete the linked Google Calendar event when one exists.
- Task creation sends a branded HTML email to the assignee and creates/updates a due-date calendar reminder event.
- Task approval, return, and cancellation send a branded HTML decision email to the assignee.
- Approved/cancelled tasks delete their due-date calendar event.
- Hourly Google Workspace cron sends deduplicated due-date reminder emails for tasks due in the next 24 hours.

## Admin settings

The integration can be tuned from `Admin -> Settings -> Integrations` without changing code:

- Enable/disable Google Workspace email notifications.
- Enable/disable Google Calendar absence events.
- Enable/disable Google Calendar task due-date events.
- Override the Google Calendar ID if needed.
- Enable/disable task-created, absence-decision, and due-date reminder emails.
- Enable/disable task decision emails for approved, returned, and cancelled tasks.
- Set the task reminder time, default `09:00`.
- Set the task reminder duration, default `15` minutes.
- Choose whether task reminders block the calendar; default is `Free`.
- Choose whether absence events block the calendar; default is `Busy`.
- Set Google Calendar color IDs for task reminders and each absence type.

Email notifications use a branded EMS HTML template with a plain-text fallback.
Task due-date calendar events are timed reminder events on the due date, while absence events remain all-day availability blockers.

## Safety notes

- Google failures are logged but do not block core EMS actions.
- `ExternalCalendarEvent` prevents duplicate Google Calendar events per EMS entity.
- `NotificationDelivery` prevents duplicate emails per dedupe key.
- Secrets live in env only; DB stores provider metadata and delivery state, not OAuth secrets.
