const { Session, Department, User, Participant, Client, Question, Response } = require("../models");
const { signAccessToken } = require("../utils/jwt");
const { notifySessionProgress } = require("./websocket.service");

function canAccessDepartment(user, department) {
  if (user.role === "super_admin") return true;
  if (user.role === "client_admin") return Number(user.client_id) === Number(department.client_id);
  if (user.role === "dept_admin" || user.role === "host") {
    return Number(user.dept_id) === Number(department.dept_id);
  }
  return false;
}

function assertSessionWriteAccess(user, session) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(session.department.client_id)) return;
  if (
    (user.role === "dept_admin" && Number(user.dept_id) === Number(session.dept_id)) ||
    (user.role === "host" && Number(user.user_id) === Number(session.host_id))
  ) {
    return;
  }
  const error = new Error("Forbidden: session access denied");
  error.statusCode = 403;
  throw error;
}

async function getDepartmentOrThrow(deptId) {
  const department = await Department.findByPk(deptId);
  if (!department) {
    const error = new Error("Department not found");
    error.statusCode = 404;
    throw error;
  }
  return department;
}

async function getSessionOrThrow(sessionId) {
  const session = await Session.findByPk(sessionId, {
    include: [
      {
        model: Department,
        include: [{ model: Client, attributes: ["client_id", "name", "slug"] }]
      },
      { model: User, attributes: ["user_id", "full_name", "email", "role"] }
    ]
  });

  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }

  return session;
}

async function generateSessionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 7; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const exists = await Session.findOne({ where: { session_code: code } });
    if (!exists) return code;
  }
  const error = new Error("Unable to generate unique session code");
  error.statusCode = 500;
  throw error;
}

async function listDepartmentSessions({ deptId, status, user }) {
  const department = await getDepartmentOrThrow(deptId);
  if (!canAccessDepartment(user, department)) {
    const error = new Error("Forbidden: department access denied");
    error.statusCode = 403;
    throw error;
  }

  const where = { dept_id: deptId };
  if (status) where.status = status;
  if (user.role === "host") where.host_id = user.user_id;

  const sessions = await Session.findAll({
    where,
    include: [{ model: User, attributes: ["user_id", "full_name", "email"] }],
    order: [["session_id", "DESC"]]
  });

  const withParticipantCounts = await Promise.all(
    sessions.map(async (session) => {
      const [participantsCount, questionCount, responses] = await Promise.all([
        Participant.count({
          where: { session_id: session.session_id }
        }),
        Question.count({
          where: { session_id: session.session_id }
        }),
        Response.findAll({
          where: { session_id: session.session_id },
          attributes: ["participant_id", "question_id"]
        })
      ]);

      const uniqueQuestionSets = new Map();
      responses.forEach((row) => {
        const key = Number(row.participant_id);
        if (!uniqueQuestionSets.has(key)) uniqueQuestionSets.set(key, new Set());
        uniqueQuestionSets.get(key).add(Number(row.question_id));
      });

      let completedParticipants = 0;
      if (questionCount > 0) {
        uniqueQuestionSets.forEach((qSet) => {
          if (qSet.size >= questionCount) completedParticipants += 1;
        });
      }

      const completionProgress =
        participantsCount > 0 ? Math.round((completedParticipants / participantsCount) * 100) : 0;

      return {
        ...session.toJSON(),
        participants_count: participantsCount,
        completed_participants: completedParticipants,
        completion_progress: completionProgress
      };
    })
  );

  return withParticipantCounts;
}

async function createSession({ deptId, input, user }) {
  const department = await getDepartmentOrThrow(deptId);
  if (!canAccessDepartment(user, department)) {
    const error = new Error("Forbidden: department access denied");
    error.statusCode = 403;
    throw error;
  }

  const host = await User.findByPk(Number(input.host_id));
  if (!host || !host.is_active) {
    const error = new Error("Host user not found or inactive");
    error.statusCode = 404;
    throw error;
  }

  if (Number(host.dept_id) !== Number(deptId)) {
    const error = new Error("Host must belong to the same department");
    error.statusCode = 400;
    throw error;
  }

  const sessionCode = await generateSessionCode();
  return Session.create({
    dept_id: Number(deptId),
    host_id: Number(input.host_id),
    title: input.title.trim(),
    description: input.description || null,
    session_code: sessionCode,
    status: "draft",
    is_anonymous_default: input.is_anonymous_default ?? false,
    max_participants: input.max_participants || 500,
    show_results_to_participants: input.show_results_to_participants ?? true,
    allow_late_join: input.allow_late_join ?? true,
    leaderboard_enabled: input.leaderboard_enabled ?? true,
    qr_code_url: input.qr_code_url || null
  });
}

async function getSessionById({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  return session;
}

async function updateSession({ sessionId, input, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  if (session.status !== "draft") {
    const error = new Error("Only draft sessions can be updated");
    error.statusCode = 400;
    throw error;
  }

  Object.assign(session, {
    title: input.title !== undefined ? input.title : session.title,
    description: input.description !== undefined ? input.description : session.description,
    is_anonymous_default:
      input.is_anonymous_default !== undefined
        ? Boolean(input.is_anonymous_default)
        : session.is_anonymous_default,
    max_participants:
      input.max_participants !== undefined
        ? Number(input.max_participants)
        : session.max_participants,
    show_results_to_participants:
      input.show_results_to_participants !== undefined
        ? Boolean(input.show_results_to_participants)
        : session.show_results_to_participants,
    allow_late_join:
      input.allow_late_join !== undefined
        ? Boolean(input.allow_late_join)
        : session.allow_late_join,
    leaderboard_enabled:
      input.leaderboard_enabled !== undefined
        ? Boolean(input.leaderboard_enabled)
        : session.leaderboard_enabled
  });

  await session.save();
  return session;
}

async function archiveSession({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  session.status = "archived";
  await session.save();
  return session;
}

async function transitionSessionStatus({ sessionId, user, action }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  const transitions = {
    start: { from: ["draft", "paused"], to: "live" },
    pause: { from: ["live"], to: "paused" },
    resume: { from: ["paused"], to: "live" },
    end: { from: ["live", "paused"], to: "completed" }
  };
  const rule = transitions[action];

  if (!rule) {
    const error = new Error("Invalid session transition");
    error.statusCode = 400;
    throw error;
  }

  if (!rule.from.includes(session.status)) {
    const error = new Error(`Cannot ${action} a session in ${session.status} status`);
    error.statusCode = 400;
    throw error;
  }

  session.status = rule.to;
  if (action === "start" && !session.started_at) session.started_at = new Date();
  if (action === "end") session.ended_at = new Date();
  await session.save();

  return session;
}

async function getSessionByCode(code) {
  const session = await Session.findOne({
    where: { session_code: code.toUpperCase() },
    include: [{ model: Department, attributes: ["dept_id", "name"] }]
  });
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  return session;
}

async function joinSession({ code, payload }) {
  const session = await getSessionByCode(code);

  if (session.status !== "live" && !(session.status === "draft" && session.allow_late_join)) {
    const error = new Error("Session is not accepting participants right now");
    error.statusCode = 400;
    throw error;
  }

  const participantsCount = await Participant.count({
    where: { session_id: session.session_id }
  });
  if (participantsCount >= session.max_participants) {
    const error = new Error("Session participant limit reached");
    error.statusCode = 403;
    throw error;
  }

  if (payload.device_fingerprint) {
    const existing = await Participant.findOne({
      where: {
        session_id: session.session_id,
        device_fingerprint: payload.device_fingerprint
      }
    });
    const wantsFreshIdentity = Boolean(payload.nickname || payload.avatar_url) || payload.force_new_participant === true;
    if (existing && !wantsFreshIdentity) {
      return {
        participant: existing,
        token: signAccessToken({
          participant_id: existing.participant_id,
          session_id: session.session_id,
          dept_id: session.dept_id,
          role: "participant"
        })
      };
    }
  }

  const participant = await Participant.create({
    session_id: session.session_id,
    dept_id: session.dept_id,
    nickname: payload.nickname || null,
    avatar_url: payload.avatar_url || null,
    is_anonymous: payload.is_anonymous ?? session.is_anonymous_default,
    device_fingerprint: payload.device_fingerprint || null
  });

  if (session.session_code) {
    notifySessionProgress(session.session_code, session.session_id).catch(() => {});
  }

  return {
    participant,
    token: signAccessToken({
      participant_id: participant.participant_id,
      session_id: session.session_id,
      dept_id: session.dept_id,
      role: "participant"
    })
  };
}

async function getSessionQr({ sessionId, user, baseUrl }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  const joinUrl = `${baseUrl}/join/${session.session_code}`;
  return {
    session_id: session.session_id,
    session_code: session.session_code,
    join_url: joinUrl,
    qr_code_url: session.qr_code_url || null
  };
}

module.exports = {
  listDepartmentSessions,
  createSession,
  getSessionById,
  updateSession,
  archiveSession,
  transitionSessionStatus,
  getSessionByCode,
  joinSession,
  getSessionQr
};
