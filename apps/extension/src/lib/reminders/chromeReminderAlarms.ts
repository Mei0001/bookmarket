const isExtensionRuntime = () => typeof chrome !== "undefined" && !!chrome.alarms;

export const REVIEW_REMINDER_ALARM_PREFIX = "review-reminder:";

export function makeReviewReminderAlarmName(reminderId: string) {
  return `${REVIEW_REMINDER_ALARM_PREFIX}${reminderId}`;
}

export async function scheduleReviewReminderAlarm(reminderId: string, scheduledForIso: string) {
  if (!isExtensionRuntime()) return;
  const when = Date.parse(scheduledForIso);
  if (!Number.isFinite(when)) throw new Error(`Invalid scheduledFor: ${scheduledForIso}`);

  const safeWhen = Math.max(Date.now() + 1_000, when);
  const name = makeReviewReminderAlarmName(reminderId);

  await chrome.alarms.create(name, { when: safeWhen });
}

export async function clearReviewReminderAlarm(reminderId: string) {
  if (!isExtensionRuntime()) return;
  const name = makeReviewReminderAlarmName(reminderId);
  await chrome.alarms.clear(name);
}

