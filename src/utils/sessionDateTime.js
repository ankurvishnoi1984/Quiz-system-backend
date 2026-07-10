function parseTimeParts(timeStr) {
  const trimmed = String(timeStr || "").trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function buildSessionDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const datePart = String(dateStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const timeParts = parseTimeParts(timeStr);
  if (!timeParts) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day, timeParts.hours, timeParts.minutes, 0, 0);
}

function buildAutoEndAt(session) {
  if (!session?.auto_end_enabled) return null;
  return buildSessionDateTime(session.auto_end_date, session.auto_end_time);
}

function buildScheduledStartAt(session) {
  return buildSessionDateTime(session?.scheduled_date, session?.scheduled_time);
}

module.exports = {
  buildSessionDateTime,
  buildAutoEndAt,
  buildScheduledStartAt,
  parseTimeParts
};
