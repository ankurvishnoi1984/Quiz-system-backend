const { Op } = require("sequelize");
const {
  Session,
  User,
  Department,
  Participant,
  Response,
  Question,
  QuestionOption
} = require("../models");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertDeptReportAdminAccess(user, dept) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(dept.client_id)) return;
  if (user.role === "dept_admin" && Number(user.dept_id) === Number(dept.dept_id)) return;
  throw createError("Forbidden: department report access denied", 403);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateRange(fromParam, toParam) {
  const to = endOfDay(toParam ? new Date(toParam) : new Date());
  const from = startOfDay(
    fromParam ? new Date(fromParam) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  );

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw createError("Invalid date range", 400);
  }

  const durationMs = to.getTime() - from.getTime();
  const previousTo = endOfDay(new Date(from.getTime() - 1));
  const previousFrom = startOfDay(new Date(previousTo.getTime() - durationMs));

  return {
    from,
    to,
    previousFrom,
    previousTo,
    from_iso: from.toISOString(),
    to_iso: to.toISOString(),
    previous_from_iso: previousFrom.toISOString(),
    previous_to_iso: previousTo.toISOString()
  };
}

function sessionActivityDate(session) {
  return session.started_at || session.created_at;
}

function buildOptionTextMap(options) {
  const map = new Map();
  for (const opt of options || []) {
    map.set(Number(opt.option_id), opt.option_text);
  }
  return map;
}

function formatResponseAnswer(response, questionType, optionMap) {
  if (response.option_id != null && optionMap.has(Number(response.option_id))) {
    return optionMap.get(Number(response.option_id));
  }
  if (response.text_response) return response.text_response;
  if (response.rating_value != null) return String(response.rating_value);
  if (Array.isArray(response.ranking_order) && response.ranking_order.length) {
    return response.ranking_order
      .map((id) => optionMap.get(Number(id)) || `#${id}`)
      .join(" > ");
  }
  return "—";
}

function computeAvgEngagementRate(sessions) {
  const rates = sessions
    .map((row) => row.engagement_rate_percent)
    .filter((value) => Number.isFinite(value));
  if (!rates.length) return 0;
  return Number((rates.reduce((sum, rate) => sum + rate, 0) / rates.length).toFixed(2));
}

function computeTrendPercent(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function buildMonthlyTrend(sessions, participants, from, to) {
  const months = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const endMonth = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= endMonth) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = monthStart.toLocaleString("en-US", { month: "short", year: "numeric" });
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    const sessionIdsInMonth = new Set(
      sessions
        .filter((session) => {
          const date = new Date(sessionActivityDate(session));
          return date >= monthStart && date <= monthEnd;
        })
        .map((session) => Number(session.session_id))
    );

    const participantIds = new Set(
      participants
        .filter((row) => sessionIdsInMonth.has(Number(row.session_id)))
        .map((row) => Number(row.participant_id))
    );

    months.push({
      month: key,
      label,
      sessions: sessionIdsInMonth.size,
      participants: participantIds.size
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

async function loadSessionsInRange(deptId, from, to) {
  const sessions = await Session.findAll({
    where: { dept_id: Number(deptId) },
    include: [{ model: User, attributes: ["user_id", "full_name", "email"] }],
    order: [["created_at", "DESC"]]
  });

  return sessions.filter((session) => {
    const activityAt = sessionActivityDate(session);
    if (!activityAt) return false;
    const date = new Date(activityAt);
    return date >= from && date <= to;
  });
}

async function buildPeriodMetrics(sessions, sessionIds) {
  if (!sessionIds.length) {
    return {
      total_sessions: 0,
      total_participants: 0,
      avg_engagement_rate_percent: 0,
      session_metrics: []
    };
  }

  const [participantRows, responseRows] = await Promise.all([
    Participant.findAll({
      where: { session_id: { [Op.in]: sessionIds } },
      attributes: ["participant_id", "session_id"],
      raw: true
    }),
    Response.findAll({
      where: { session_id: { [Op.in]: sessionIds } },
      attributes: ["session_id", "participant_id"],
      raw: true
    })
  ]);

  const participantsBySession = new Map();
  for (const row of participantRows) {
    const sid = Number(row.session_id);
    if (!participantsBySession.has(sid)) participantsBySession.set(sid, new Set());
    participantsBySession.get(sid).add(Number(row.participant_id));
  }

  const respondersBySession = new Map();
  for (const row of responseRows) {
    const sid = Number(row.session_id);
    if (!respondersBySession.has(sid)) respondersBySession.set(sid, new Set());
    respondersBySession.get(sid).add(Number(row.participant_id));
  }

  const sessionMetrics = sessions.map((session) => {
    const sid = Number(session.session_id);
    const participantCount = participantsBySession.get(sid)?.size || 0;
    const responderCount = respondersBySession.get(sid)?.size || 0;
    const engagementRatePercent =
      participantCount > 0
        ? Number(((responderCount / participantCount) * 100).toFixed(2))
        : 0;
    return {
      session_id: sid,
      participant_count: participantCount,
      engagement_rate_percent: engagementRatePercent
    };
  });

  const totalParticipants = new Set(participantRows.map((row) => Number(row.participant_id))).size;

  return {
    total_sessions: sessions.length,
    total_participants: totalParticipants,
    avg_engagement_rate_percent: computeAvgEngagementRate(sessionMetrics),
    session_metrics: sessionMetrics
  };
}

async function getDepartmentReport({ deptId, user, from: fromParam, to: toParam }) {
  const department = await Department.findByPk(Number(deptId));
  if (!department) throw createError("Department not found", 404);
  assertDeptReportAdminAccess(user, department);

  const range = parseDateRange(fromParam, toParam);
  const previousRange = {
    from: range.previousFrom,
    to: range.previousTo
  };

  const [currentSessions, previousSessions] = await Promise.all([
    loadSessionsInRange(deptId, range.from, range.to),
    loadSessionsInRange(deptId, previousRange.from, previousRange.to)
  ]);

  const currentSessionIds = currentSessions.map((s) => Number(s.session_id));
  const previousSessionIds = previousSessions.map((s) => Number(s.session_id));

  const [currentMetrics, previousMetrics] = await Promise.all([
    buildPeriodMetrics(currentSessions, currentSessionIds),
    buildPeriodMetrics(previousSessions, previousSessionIds)
  ]);

  const metricsBySessionId = new Map(
    (currentMetrics.session_metrics || []).map((row) => [row.session_id, row])
  );

  const hostCounts = new Map();
  for (const session of currentSessions) {
    const host = session.User || session.user;
    const hostId = Number(session.host_id);
    const hostName = host?.full_name || host?.email || `Host ${hostId}`;
    const existing = hostCounts.get(hostId) || { host_id: hostId, host_name: hostName, session_count: 0 };
    existing.session_count += 1;
    hostCounts.set(hostId, existing);
  }

  const mostActiveHost =
    hostCounts.size > 0
      ? [...hostCounts.values()].sort((a, b) => b.session_count - a.session_count)[0]
      : null;

  const participantsInRange =
    currentSessionIds.length > 0
      ? await Participant.findAll({
          where: { session_id: { [Op.in]: currentSessionIds } },
          attributes: ["participant_id", "session_id"]
        })
      : [];

  const monthlyTrend = buildMonthlyTrend(currentSessions, participantsInRange, range.from, range.to);

  const sessionsTable = currentSessions.map((session) => {
    const host = session.User || session.user;
    const metrics = metricsBySessionId.get(Number(session.session_id)) || {
      participant_count: 0,
      engagement_rate_percent: 0
    };
    const activityAt = sessionActivityDate(session);
    return {
      session_id: session.session_id,
      title: session.title,
      date: activityAt,
      host_name: host?.full_name || host?.email || "—",
      host_id: session.host_id,
      status: session.status,
      participant_count: metrics.participant_count,
      engagement_rate_percent: metrics.engagement_rate_percent
    };
  });

  let responseRows = [];
  if (currentSessionIds.length > 0) {
    const [questions, responses] = await Promise.all([
      Question.findAll({
        where: { session_id: { [Op.in]: currentSessionIds } },
        include: [{ model: QuestionOption }],
        attributes: ["question_id", "session_id", "question_text", "question_type"]
      }),
      Response.findAll({
        where: { session_id: { [Op.in]: currentSessionIds } },
        include: [{ model: QuestionOption, attributes: ["option_id", "option_text"] }],
        order: [["submitted_at", "ASC"]]
      })
    ]);

    const questionsById = new Map(questions.map((q) => [Number(q.question_id), q]));

    responseRows = responses.map((row) => {
      const question = questionsById.get(Number(row.question_id));
      const options = question?.QuestionOptions || question?.question_options || [];
      const optionMap = buildOptionTextMap(options);
      return {
        session_id: row.session_id,
        question_id: row.question_id,
        participant_id: row.participant_id,
        answer: formatResponseAnswer(row, question?.question_type, optionMap),
        submitted_at: row.submitted_at
      };
    });
  }

  return {
    department: {
      dept_id: department.dept_id,
      name: department.name
    },
    date_range: {
      from: range.from_iso,
      to: range.to_iso,
      previous_from: range.previous_from_iso,
      previous_to: range.previous_to_iso
    },
    summary: {
      total_sessions: currentMetrics.total_sessions,
      total_participants: currentMetrics.total_participants,
      avg_engagement_rate_percent: currentMetrics.avg_engagement_rate_percent,
      previous_total_sessions: previousMetrics.total_sessions,
      previous_total_participants: previousMetrics.total_participants,
      previous_avg_engagement_rate_percent: previousMetrics.avg_engagement_rate_percent,
      sessions_trend_percent: computeTrendPercent(
        currentMetrics.total_sessions,
        previousMetrics.total_sessions
      ),
      participants_trend_percent: computeTrendPercent(
        currentMetrics.total_participants,
        previousMetrics.total_participants
      ),
      engagement_trend_percent: Number(
        (
          currentMetrics.avg_engagement_rate_percent -
          previousMetrics.avg_engagement_rate_percent
        ).toFixed(2)
      )
    },
    most_active_host: mostActiveHost,
    monthly_trend: monthlyTrend,
    sessions: sessionsTable,
    response_rows: responseRows
  };
}

module.exports = {
  getDepartmentReport
};
