const { Op } = require("sequelize");
const { Session, User, Department, Client, Participant, Response } = require("../models");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertClientReportSuperAdminAccess(user, client) {
  if (user.role === "super_admin") return;
  throw createError("Forbidden: client report access denied", 403);
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

  return {
    from,
    to,
    from_iso: from.toISOString(),
    to_iso: to.toISOString()
  };
}

function sessionActivityDate(session) {
  return session.started_at || session.created_at;
}

function filterSessionsInRange(sessions, from, to) {
  return sessions.filter((session) => {
    const activityAt = sessionActivityDate(session);
    if (!activityAt) return false;
    const date = new Date(activityAt);
    return date >= from && date <= to;
  });
}

async function buildSessionMetrics(sessionIds) {
  if (!sessionIds.length) {
    return {
      participantsBySession: new Map(),
      respondersBySession: new Map(),
      totalParticipants: 0
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
  const allParticipantIds = new Set();

  for (const row of participantRows) {
    const sid = Number(row.session_id);
    allParticipantIds.add(Number(row.participant_id));
    if (!participantsBySession.has(sid)) participantsBySession.set(sid, new Set());
    participantsBySession.get(sid).add(Number(row.participant_id));
  }

  const respondersBySession = new Map();
  for (const row of responseRows) {
    const sid = Number(row.session_id);
    if (!respondersBySession.has(sid)) respondersBySession.set(sid, new Set());
    respondersBySession.get(sid).add(Number(row.participant_id));
  }

  return {
    participantsBySession,
    respondersBySession,
    totalParticipants: allParticipantIds.size
  };
}

function engagementRateForSession(participantsBySession, respondersBySession, sessionId) {
  const participantCount = participantsBySession.get(sessionId)?.size || 0;
  const responderCount = respondersBySession.get(sessionId)?.size || 0;
  return participantCount > 0
    ? Number(((responderCount / participantCount) * 100).toFixed(2))
    : 0;
}

async function getClientReport({ clientId, user, from: fromParam, to: toParam }) {
  const client = await Client.findByPk(Number(clientId));
  if (!client) throw createError("Client not found", 404);
  assertClientReportSuperAdminAccess(user, client);

  const range = parseDateRange(fromParam, toParam);
  const departments = await Department.findAll({
    where: { client_id: Number(clientId) },
    attributes: ["dept_id", "name"],
    order: [["name", "ASC"]]
  });

  const deptIds = departments.map((d) => Number(d.dept_id));
  const deptNameById = new Map(departments.map((d) => [Number(d.dept_id), d.name]));

  const allSessionsRaw =
    deptIds.length > 0
      ? await Session.findAll({
          where: { dept_id: { [Op.in]: deptIds } },
          include: [{ model: User, attributes: ["user_id", "full_name", "email"] }],
          order: [["created_at", "DESC"]]
        })
      : [];

  const sessionsInRange = filterSessionsInRange(allSessionsRaw, range.from, range.to);
  const sessionIds = sessionsInRange.map((s) => Number(s.session_id));

  const { participantsBySession, respondersBySession, totalParticipants } =
    await buildSessionMetrics(sessionIds);

  const sessionsTableRows = sessionsInRange.map((session) => {
    const sid = Number(session.session_id);
    const host = session.User || session.user;
    return {
      session_id: sid,
      dept_id: session.dept_id,
      dept_name: deptNameById.get(Number(session.dept_id)) || "—",
      title: session.title,
      date: sessionActivityDate(session),
      host_name: host?.full_name || host?.email || "—",
      status: session.status,
      participant_count: participantsBySession.get(sid)?.size || 0,
      engagement_rate_percent: engagementRateForSession(
        participantsBySession,
        respondersBySession,
        sid
      )
    };
  });

  const departmentBuckets = new Map();
  for (const dept of departments) {
    departmentBuckets.set(Number(dept.dept_id), {
      dept_id: dept.dept_id,
      dept_name: dept.name,
      session_count: 0,
      participant_ids: new Set(),
      engagement_rates: [],
      sessions: []
    });
  }

  for (const row of sessionsTableRows) {
    const bucket = departmentBuckets.get(Number(row.dept_id));
    if (!bucket) continue;
    bucket.session_count += 1;
    bucket.engagement_rates.push(row.engagement_rate_percent);
    bucket.sessions.push(row);
    const participantSet = participantsBySession.get(Number(row.session_id));
    if (participantSet) {
      participantSet.forEach((pid) => bucket.participant_ids.add(pid));
    }
  }

  const departmentComparison = [...departmentBuckets.values()].map((bucket) => {
    const engagementRate =
      bucket.engagement_rates.length > 0
        ? Number(
            (
              bucket.engagement_rates.reduce((sum, rate) => sum + rate, 0) /
              bucket.engagement_rates.length
            ).toFixed(2)
          )
        : 0;
    return {
      dept_id: bucket.dept_id,
      dept_name: bucket.dept_name,
      session_count: bucket.session_count,
      participant_count: bucket.participant_ids.size,
      engagement_rate_percent: engagementRate
    };
  });

  const topDepartments = [...departmentComparison]
    .sort((a, b) => {
      if (b.session_count !== a.session_count) return b.session_count - a.session_count;
      return b.engagement_rate_percent - a.engagement_rate_percent;
    })
    .slice(0, 3);

  const [totalHosts, activeHostRows] = await Promise.all([
    User.count({
      where: {
        client_id: Number(clientId),
        role: "host",
        is_active: true
      }
    }),
    sessionIds.length
      ? Session.findAll({
          attributes: ["host_id"],
          where: { session_id: { [Op.in]: sessionIds } },
          group: ["host_id"],
          raw: true
        })
      : []
  ]);

  const activeHosts = activeHostRows.length;
  const utilizationPercent =
    totalHosts > 0 ? Number(((activeHosts / totalHosts) * 100).toFixed(2)) : 0;

  return {
    client: {
      client_id: client.client_id,
      name: client.name
    },
    date_range: {
      from: range.from_iso,
      to: range.to_iso
    },
    summary: {
      total_sessions: sessionsInRange.length,
      total_participants: totalParticipants,
      total_departments: departments.length,
      departments_with_activity: departmentComparison.filter((d) => d.session_count > 0).length,
      host_utilization: {
        active_hosts: activeHosts,
        total_hosts: totalHosts,
        utilization_percent: utilizationPercent
      }
    },
    department_comparison: departmentComparison.sort(
      (a, b) => b.engagement_rate_percent - a.engagement_rate_percent
    ),
    top_departments: topDepartments,
    departments: [...departmentBuckets.values()].map((bucket) => ({
      dept_id: bucket.dept_id,
      dept_name: bucket.dept_name,
      sessions: bucket.sessions
    })),
    all_sessions: sessionsTableRows
  };
}

module.exports = {
  getClientReport
};
