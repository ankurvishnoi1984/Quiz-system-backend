const { Op } = require("sequelize");
const {
  AnalyticsSession,
  AnalyticsParticipant,
  AnalyticsResponse,
  AnalyticsQuestion,
  Department,
  Client
} = {
  AnalyticsSession: require("../models/session.model"),
  AnalyticsParticipant: require("../models/participant.model"),
  AnalyticsResponse: require("../models/response.model"),
  AnalyticsQuestion: require("../models/question.model"),
  Department: require("../models/department.model"),
  Client: require("../models/client.model")
};

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertDeptAccess(user, dept) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(dept.client_id)) return;
  if (Number(user.dept_id) === Number(dept.dept_id) && ["dept_admin", "host"].includes(user.role)) return;
  throw createError("Forbidden: analytics access denied", 403);
}

function assertClientAccess(user, clientId) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(clientId)) return;
  throw createError("Forbidden: analytics access denied", 403);
}

async function getDepartmentOrThrow(deptId) {
  const department = await Department.findByPk(Number(deptId));
  if (!department) throw createError("Department not found", 404);
  return department;
}

async function getSessionSummariesByDept(deptId) {
  const sessions = await AnalyticsSession.findAll({
    where: { dept_id: Number(deptId) },
    order: [["created_at", "DESC"]]
  });

  const sessionIds = sessions.map((s) => s.session_id);
  if (sessionIds.length === 0) return [];

  const [participantCounts, responseCounts, questionCounts, uniqueResponderCounts] = await Promise.all([
    AnalyticsParticipant.findAll({
      attributes: ["session_id", [AnalyticsParticipant.sequelize.fn("COUNT", "*"), "count"]],
      where: { session_id: { [Op.in]: sessionIds } },
      group: ["session_id"],
      raw: true
    }),
    AnalyticsResponse.findAll({
      attributes: ["session_id", [AnalyticsResponse.sequelize.fn("COUNT", "*"), "count"]],
      where: { session_id: { [Op.in]: sessionIds } },
      group: ["session_id"],
      raw: true
    }),
    AnalyticsQuestion.findAll({
      attributes: ["session_id", [AnalyticsQuestion.sequelize.fn("COUNT", "*"), "count"]],
      where: { session_id: { [Op.in]: sessionIds } },
      group: ["session_id"],
      raw: true
    }),
    AnalyticsResponse.findAll({
      attributes: [
        "session_id",
        [AnalyticsResponse.sequelize.fn("COUNT", AnalyticsResponse.sequelize.fn("DISTINCT", AnalyticsResponse.sequelize.col("participant_id"))), "count"]
      ],
      where: { session_id: { [Op.in]: sessionIds } },
      group: ["session_id"],
      raw: true
    })
  ]);

  const toMap = (rows) =>
    rows.reduce((acc, row) => {
      acc[Number(row.session_id)] = Number(row.count);
      return acc;
    }, {});

  const participantMap = toMap(participantCounts);
  const responseMap = toMap(responseCounts);
  const questionMap = toMap(questionCounts);
  const uniqueResponderMap = toMap(uniqueResponderCounts);

  return sessions.map((session) => {
    const sessionId = Number(session.session_id);
    const participantCount = participantMap[sessionId] || 0;
    const responseCount = responseMap[sessionId] || 0;
    const questionCount = questionMap[sessionId] || 0;
    const uniqueResponders = uniqueResponderMap[sessionId] || 0;
    const responseRatePercent =
      participantCount > 0 ? Number(((uniqueResponders / participantCount) * 100).toFixed(2)) : 0;
    const avgResponsesPerQuestion =
      questionCount > 0 ? Number((responseCount / questionCount).toFixed(2)) : 0;

    return {
      session_id: sessionId,
      title: session.title,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      participant_count: participantCount,
      response_count: responseCount,
      question_count: questionCount,
      active_responders: uniqueResponders,
      response_rate_percent: responseRatePercent,
      avg_responses_per_question: avgResponsesPerQuestion
    };
  });
}

async function getDepartmentOverview({ deptId, user }) {
  const department = await getDepartmentOrThrow(deptId);
  assertDeptAccess(user, department);

  const sessions = await getSessionSummariesByDept(deptId);
  const sessionIds = sessions.map((s) => s.session_id);

  let topQuestions = [];
  if (sessionIds.length > 0) {
    const questions = await AnalyticsQuestion.findAll({
      attributes: ["question_id", "question_text", "session_id"],
      where: { session_id: { [Op.in]: sessionIds } },
      raw: true
    });
    const questionIds = questions.map((q) => q.question_id);
    const responseRows =
      questionIds.length > 0
        ? await AnalyticsResponse.findAll({
            attributes: ["question_id", [AnalyticsResponse.sequelize.fn("COUNT", "*"), "count"]],
            where: { question_id: { [Op.in]: questionIds } },
            group: ["question_id"],
            raw: true
          })
        : [];
    const responseMap = responseRows.reduce((acc, row) => {
      acc[Number(row.question_id)] = Number(row.count);
      return acc;
    }, {});
    topQuestions = questions
      .map((q) => ({
        question_id: Number(q.question_id),
        session_id: Number(q.session_id),
        question_text: q.question_text,
        response_count: responseMap[Number(q.question_id)] || 0
      }))
      .sort((a, b) => b.response_count - a.response_count)
      .slice(0, 5);
  }

  const totals = sessions.reduce(
    (acc, session) => {
      acc.total_participants += session.participant_count;
      acc.total_responses += session.response_count;
      acc.total_questions += session.question_count;
      acc.response_rate_sum += session.response_rate_percent;
      return acc;
    },
    { total_participants: 0, total_responses: 0, total_questions: 0, response_rate_sum: 0 }
  );

  return {
    dept_id: Number(deptId),
    sessions_count: sessions.length,
    total_participants: totals.total_participants,
    total_responses: totals.total_responses,
    total_questions: totals.total_questions,
    avg_response_rate_percent:
      sessions.length > 0 ? Number((totals.response_rate_sum / sessions.length).toFixed(2)) : 0,
    top_questions: topQuestions
  };
}

async function getDepartmentSessionsAnalytics({ deptId, user }) {
  const department = await getDepartmentOrThrow(deptId);
  assertDeptAccess(user, department);
  return getSessionSummariesByDept(deptId);
}

async function getClientOverview({ clientId, user }) {
  const client = await Client.findByPk(Number(clientId));
  if (!client) throw createError("Client not found", 404);
  assertClientAccess(user, client.client_id);

  const departments = await Department.findAll({
    where: { client_id: Number(clientId) },
    attributes: ["dept_id", "name"],
    raw: true
  });
  const overviews = await Promise.all(
    departments.map((dept) => getDepartmentOverview({ deptId: dept.dept_id, user: { ...user, role: "super_admin" } }))
  );

  const aggregate = overviews.reduce(
    (acc, overview) => {
      acc.sessions_count += overview.sessions_count;
      acc.total_participants += overview.total_participants;
      acc.total_responses += overview.total_responses;
      acc.total_questions += overview.total_questions;
      acc.avg_response_rate_sum += overview.avg_response_rate_percent;
      return acc;
    },
    {
      sessions_count: 0,
      total_participants: 0,
      total_responses: 0,
      total_questions: 0,
      avg_response_rate_sum: 0
    }
  );

  return {
    client_id: Number(clientId),
    departments_count: departments.length,
    sessions_count: aggregate.sessions_count,
    total_participants: aggregate.total_participants,
    total_responses: aggregate.total_responses,
    total_questions: aggregate.total_questions,
    avg_response_rate_percent:
      overviews.length > 0 ? Number((aggregate.avg_response_rate_sum / overviews.length).toFixed(2)) : 0
  };
}

async function getSessionReport({ sessionId, user }) {
  const session = await AnalyticsSession.findByPk(Number(sessionId));
  if (!session) throw createError("Session not found", 404);

  const dept = await getDepartmentOrThrow(session.dept_id);
  assertDeptAccess(user, dept);

  const [participantCount, responseCount, questionCount, uniqueResponders, questionRows] = await Promise.all([
    AnalyticsParticipant.count({ where: { session_id: session.session_id } }),
    AnalyticsResponse.count({ where: { session_id: session.session_id } }),
    AnalyticsQuestion.count({ where: { session_id: session.session_id } }),
    AnalyticsResponse.count({
      distinct: true,
      col: "participant_id",
      where: { session_id: session.session_id }
    }),
    AnalyticsQuestion.findAll({
      where: { session_id: session.session_id },
      attributes: ["question_id", "question_text", "question_type"],
      raw: true
    })
  ]);

  const questionIds = questionRows.map((row) => row.question_id);
  const responseByQuestion =
    questionIds.length > 0
      ? await AnalyticsResponse.findAll({
          attributes: ["question_id", [AnalyticsResponse.sequelize.fn("COUNT", "*"), "count"]],
          where: { question_id: { [Op.in]: questionIds } },
          group: ["question_id"],
          raw: true
        })
      : [];
  const byQuestionMap = responseByQuestion.reduce((acc, row) => {
    acc[Number(row.question_id)] = Number(row.count);
    return acc;
  }, {});

  return {
    session: {
      session_id: session.session_id,
      title: session.title,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at
    },
    stats: {
      participant_count: participantCount,
      response_count: responseCount,
      question_count: questionCount,
      active_responders: uniqueResponders,
      response_rate_percent:
        participantCount > 0 ? Number(((uniqueResponders / participantCount) * 100).toFixed(2)) : 0
    },
    question_breakdown: questionRows.map((row) => ({
      question_id: row.question_id,
      question_text: row.question_text,
      question_type: row.question_type,
      response_count: byQuestionMap[Number(row.question_id)] || 0
    }))
  };
}

function toCsv(rows) {
  if (rows.length === 0) return "session_id,title,status,participant_count,response_count,question_count,response_rate_percent";
  const header = Object.keys(rows[0]);
  const csvRows = rows.map((row) =>
    header.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(",")
  );
  return [header.join(","), ...csvRows].join("\n");
}

async function getDepartmentExport({ deptId, user }) {
  const rows = await getDepartmentSessionsAnalytics({ deptId, user });
  return toCsv(rows);
}

module.exports = {
  getDepartmentOverview,
  getDepartmentSessionsAnalytics,
  getClientOverview,
  getDepartmentExport,
  getSessionReport
};
