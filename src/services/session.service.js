const { sequelize } = require("../config/database");
const {
  Session,
  Department,
  User,
  Participant,
  Client,
  Question,
  QuestionOption,
  Response
} = require("../models");
const {
  isMultiNavTimedJoinClosed,
  MULTI_NAV_TIMED_JOIN_CLOSED_MESSAGE
} = require("../utils/sessionFlags");
const { ensureAllQuestionsLiveForQuizTotalTimeSession } = require("./question.service");
const {
  assertParticipantCapacity,
  assertSessionAcceptingJoin,
  finalizeParticipantJoin,
  findParticipantByDeviceFingerprint,
  findParticipantByNameEmail,
  normalizeParticipantEmail,
  wantsFreshParticipantIdentity,
  normalizeParticipantNickname
} = require("./participant.service");
const {
  getPlanJoinBlock,
  notifyHostPlanLimitIfNeeded
} = require("./plan.service");

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

  if (
    user.role !== "super_admin" &&
    Number(host.dept_id) !== Number(deptId)
  ) {
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
     scheduled_date: input.scheduled_date || null,
     scheduled_time: input.scheduled_time || null,
     auto_end_enabled: Boolean(input.auto_end_enabled),
     auto_end_date: input.auto_end_enabled ? input.auto_end_date || null : null,
     auto_end_time: input.auto_end_enabled ? input.auto_end_time || null : null,
     session_code: sessionCode,
     status: "draft",
     join_type: input.join_type ?? 'name',
     max_participants: input.max_participants || 500,
     show_results_to_participants: input.show_results_to_participants ?? true,
     allow_late_join: false,
     leaderboard_enabled: input.leaderboard_enabled ?? false,
     survey_results_enabled: input.survey_results_enabled ?? false,
     show_question_leaderboard: input.show_question_leaderboard ?? false,
     participant_navigation_enabled:
       input.participant_navigation_enabled !== undefined
         ? Boolean(input.participant_navigation_enabled)
         : false,
     quiz_total_time_minutes:
       input.participant_navigation_enabled && input.quiz_total_time_minutes != null
         ? Number(input.quiz_total_time_minutes)
         : null,
     qr_code_url: input.qr_code_url || null,
     logo_url:
       input.logo_url != null && String(input.logo_url).trim()
         ? String(input.logo_url).trim()
         : null
   });
}

/**
 * Creates a new draft session and copies all questions + options from the source session.
 */
async function duplicateSession({ sourceSessionId, user, input = {} }) {
  const source = await getSessionOrThrow(sourceSessionId);
  assertSessionWriteAccess(user, source);

  let hostId = Number(source.host_id);
  if (input.host_id != null && input.host_id !== "") {
    hostId = Number(input.host_id);
    if (Number.isNaN(hostId)) {
      const error = new Error("host_id must be a number");
      error.statusCode = 400;
      throw error;
    }
    const host = await User.findByPk(hostId);
    if (!host || !host.is_active) {
      const error = new Error("Host user not found or inactive");
      error.statusCode = 404;
      throw error;
    }
    if (
      user.role !== "super_admin" &&
      Number(host.dept_id) !== Number(source.dept_id)
    ) {
      const error = new Error("Host must belong to the same department as the session");
      error.statusCode = 400;
      throw error;
    }
  }

  const rawTitle =
    typeof input.title === "string" && input.title.trim().length > 0
      ? input.title.trim()
      : `${source.title} (Copy)`;
  const title = rawTitle.slice(0, 255);

  const transaction = await sequelize.transaction();
  try {
    const sessionCode = await generateSessionCode();
    const newSession = await Session.create(
      {
        dept_id: source.dept_id,
        host_id: hostId,
        title,
        description: source.description,
        scheduled_date: source.scheduled_date || null,
        scheduled_time: source.scheduled_time || null,
        auto_end_enabled: Boolean(source.auto_end_enabled),
        auto_end_date: source.auto_end_enabled ? source.auto_end_date || null : null,
        auto_end_time: source.auto_end_enabled ? source.auto_end_time || null : null,
        session_code: sessionCode,
        status: "draft",
        join_type: source.join_type || "name",
        max_participants: source.max_participants ?? 500,
        show_results_to_participants: source.show_results_to_participants ?? true,
        allow_late_join: source.allow_late_join ?? false,
        leaderboard_enabled: source.leaderboard_enabled ?? false,
        survey_results_enabled: source.survey_results_enabled ?? false,
        show_question_leaderboard: source.show_question_leaderboard ?? false,
        participant_navigation_enabled: source.participant_navigation_enabled ?? true,
        quiz_total_time_minutes: source.quiz_total_time_minutes ?? null,
        qr_code_url: null,
        logo_url: source.logo_url || null
      },
      { transaction }
    );

    const { QuestionSet } = require("../models");
    const sourceSets = await QuestionSet.findAll({
      where: { session_id: sourceSessionId },
      order: [
        ["display_order", "ASC"],
        ["set_id", "ASC"]
      ],
      transaction
    });
    const setIdMap = new Map();
    for (const sourceSet of sourceSets) {
      const copied = await QuestionSet.create(
        {
          session_id: newSession.session_id,
          name: sourceSet.name,
          display_order: sourceSet.display_order
        },
        { transaction }
      );
      setIdMap.set(Number(sourceSet.set_id), copied.set_id);
    }

    const questions = await Question.findAll({
      where: { session_id: sourceSessionId },
      include: [{ model: QuestionOption }],
      order: [
        ["display_order", "ASC"],
        [QuestionOption, "display_order", "ASC"]
      ],
      transaction
    });

    for (const q of questions) {
      const isPoll = q.question_type === "poll";
      const isSurvey = q.question_type === "survey";
      const isEmojiReaction = q.question_type === "emoji_reaction";
      const isNonScored = isPoll || isSurvey || isEmojiReaction;

      const newQuestion = await Question.create(
        {
          session_id: newSession.session_id,
          dept_id: newSession.dept_id,
          question_type: q.question_type,
          question_text: q.question_text,
          media_url: q.media_url,
          media_type: q.media_type,
          media_thumbnail_url: q.media_thumbnail_url,
          is_quiz_mode: isNonScored ? false : q.is_quiz_mode ?? false,
          points_value: isNonScored ? 0 : q.points_value ?? 10,
          time_limit_seconds: isSurvey ? null : q.time_limit_seconds,
          allow_multiple_select: q.allow_multiple_select ?? false,
          survey_subtype: isSurvey ? q.survey_subtype || null : null,
          rating_min: q.rating_min ?? 1,
          rating_max: q.rating_max ?? 10,
          rating_min_label: q.rating_min_label,
          rating_max_label: q.rating_max_label,
          is_live: false,
          show_leaderboard: false,
          display_order: q.display_order,
          template_id: q.template_id || null,
          set_id: q.set_id ? setIdMap.get(Number(q.set_id)) || null : null
        },
        { transaction }
      );

      let rawOpts = q.QuestionOptions || q.question_options;
      if (!rawOpts || rawOpts.length === 0) {
        rawOpts = await QuestionOption.findAll({
          where: { question_id: q.question_id },
          order: [["display_order", "ASC"]],
          transaction
        });
      }
      if (rawOpts.length > 0) {
        await QuestionOption.bulkCreate(
          rawOpts.map((o, idx) => ({
            question_id: newQuestion.question_id,
            option_text: o.option_text,
            media_url: o.media_url || null,
            is_correct: isNonScored ? false : o.is_correct ?? false,
            display_order: o.display_order != null ? o.display_order : idx + 1
          })),
          { transaction }
        );
      }
    }

    await transaction.commit();
    return getSessionOrThrow(newSession.session_id);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function getSessionById({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  return session;
}

async function updateSession({ sessionId, input, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  const liveSettingsOnly = ["leaderboard_enabled", "survey_results_enabled", "title", "logo_url"];
  const inputKeys = Object.keys(input || {});

  if (session.status !== "draft") {
    const disallowed = inputKeys.filter((key) => !liveSettingsOnly.includes(key));
    if (disallowed.length > 0) {
      const error = new Error(
        "Only session title, logo, and leaderboard settings can be updated while the session is live"
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const nextParticipantNavigationEnabled =
    input.participant_navigation_enabled !== undefined
      ? Boolean(input.participant_navigation_enabled)
      : session.participant_navigation_enabled;

  let nextQuizTotalTimeMinutes = session.quiz_total_time_minutes;
  if (!nextParticipantNavigationEnabled) {
    nextQuizTotalTimeMinutes = null;
  } else if (input.quiz_total_time_minutes !== undefined) {
    nextQuizTotalTimeMinutes =
      input.quiz_total_time_minutes == null || input.quiz_total_time_minutes === ""
        ? null
        : Number(input.quiz_total_time_minutes);
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
    leaderboard_enabled:
      input.leaderboard_enabled !== undefined
        ? Boolean(input.leaderboard_enabled)
        : session.leaderboard_enabled,
    survey_results_enabled:
      input.survey_results_enabled !== undefined
        ? Boolean(input.survey_results_enabled)
        : session.survey_results_enabled,
    show_question_leaderboard:
      input.show_question_leaderboard !== undefined
        ? Boolean(input.show_question_leaderboard)
        : session.show_question_leaderboard,
    participant_navigation_enabled:
      input.participant_navigation_enabled !== undefined
        ? Boolean(input.participant_navigation_enabled)
        : session.participant_navigation_enabled,
    quiz_total_time_minutes: nextQuizTotalTimeMinutes,
    join_type:
      input.join_type !== undefined ? input.join_type : session.join_type,
    scheduled_date:
      input.scheduled_date !== undefined ? input.scheduled_date || null : session.scheduled_date,
    scheduled_time:
      input.scheduled_time !== undefined ? input.scheduled_time || null : session.scheduled_time,
    auto_end_enabled:
      input.auto_end_enabled !== undefined
        ? Boolean(input.auto_end_enabled)
        : session.auto_end_enabled,
    auto_end_date:
      input.auto_end_enabled !== undefined
        ? input.auto_end_enabled
          ? input.auto_end_date || null
          : null
        : session.auto_end_date,
    auto_end_time:
      input.auto_end_enabled !== undefined
        ? input.auto_end_enabled
          ? input.auto_end_time || null
          : null
        : session.auto_end_time,
    logo_url:
      input.logo_url !== undefined
        ? input.logo_url != null && String(input.logo_url).trim()
          ? String(input.logo_url).trim()
          : null
        : session.logo_url
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

/**
 * Soft-delete all responses and participants for a session (no hard deletes).
 * Participants can rejoin as new records afterward.
 * Completed sessions are moved back to draft so they can be edited/relaunched.
 */
async function resetSessionResponses({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  if (session.status === "archived") {
    const error = new Error("Cannot reset responses for an archived session");
    error.statusCode = 400;
    throw error;
  }

  const wasCompleted = session.status === "completed";

  const result = await sequelize.transaction(async (transaction) => {
    // Soft-delete only (paranoid models). Never pass force: true here.
    const [responsesCleared] = await Response.update(
      { deleted_at: new Date() },
      {
        where: {
          session_id: session.session_id,
          deleted_at: null
        },
        transaction,
        paranoid: false
      }
    );
    const [participantsCleared] = await Participant.update(
      { deleted_at: new Date() },
      {
        where: {
          session_id: session.session_id,
          deleted_at: null
        },
        transaction,
        paranoid: false
      }
    );

    if (wasCompleted) {
      session.status = "draft";
      if (Object.prototype.hasOwnProperty.call(session.dataValues, "ended_at")) {
        session.ended_at = null;
      }
      await session.save({ transaction });
    }

    return {
      session_id: session.session_id,
      status: session.status,
      responses_cleared: responsesCleared,
      participants_cleared: participantsCleared,
      restored_to_draft: wasCompleted
    };
  });

  return result;
}

async function endSessionBySystem(session, endedAt = new Date()) {
  if (!session || !["live", "paused"].includes(session.status)) {
    return null;
  }

  session.status = "completed";
  session.ended_at = endedAt;
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

  if (action === "start") {
    await ensureAllQuestionsLiveForQuizTotalTimeSession(session);
  }

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

function participantJoinLabel(participant) {
  const nickname = String(participant?.nickname || "").trim();
  if (nickname) return nickname;
  if (participant?.is_anonymous) return "Anonymous";
  return `Participant ${participant.participant_id}`;
}

function resolveParticipantAnonymous(session, payload) {
  if (payload.is_anonymous !== undefined) {
    return Boolean(payload.is_anonymous);
  }
  if (session.join_type === "anonymous") {
    return true;
  }
  return Boolean(session.is_anonymous_default);
}

async function nextAnonymousNickname(sessionId) {
  const anonymousCount = await Participant.count({
    where: { session_id: sessionId, is_anonymous: true }
  });
  return `Anonymous${anonymousCount + 1}`;
}

async function listSessionParticipants({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  const rows = await Participant.findAll({
    where: { session_id: session.session_id },
    attributes: ["participant_id", "nickname", "is_anonymous", "joined_at"],
    order: [
      ["joined_at", "ASC"],
      ["participant_id", "ASC"]
    ]
  });

  return rows.map((row) => ({
    participant_id: row.participant_id,
    nickname: participantJoinLabel(row)
  }));
}

async function getSessionJoinBlockInfo(session, { notifyHost = false } = {}) {
  const planBlock = await getPlanJoinBlock(session);
  if (planBlock.blocked) {
    if (notifyHost) {
      void notifyHostPlanLimitIfNeeded(planBlock.usage);
    }
    return {
      blocked: true,
      message: planBlock.message,
      reason: "plan_limit"
    };
  }

  if (session.status !== "live" && session.status !== "paused") {
    return { blocked: false, message: null, reason: null };
  }

  const questions = await Question.findAll({
    where: { session_id: session.session_id },
    attributes: ["question_id", "display_order", "time_limit_seconds", "is_live", "live_activated_at"],
    order: [
      ["display_order", "ASC"],
      ["question_id", "ASC"]
    ]
  });

  if (!isMultiNavTimedJoinClosed(session, questions)) {
    return { blocked: false, message: null, reason: null };
  }

  return {
    blocked: true,
    message: MULTI_NAV_TIMED_JOIN_CLOSED_MESSAGE,
    reason: "timed_join"
  };
}

async function assertNewParticipantMayJoin(session) {
  const { blocked, message } = await getSessionJoinBlockInfo(session, { notifyHost: true });
  if (!blocked) return;

  const error = new Error(message || MULTI_NAV_TIMED_JOIN_CLOSED_MESSAGE);
  error.statusCode = 403;
  throw error;
}

async function joinSession({ code, payload }) {
  const session = await getSessionByCode(code);
  const joinPayload = payload || {};

    const existingByIdentity = await findParticipantByNameEmail(session, joinPayload);
  if (existingByIdentity) {
    assertSessionAcceptingJoin(session, { isReturning: true });
    const { assignRandomSetToParticipant } = require("./question-set.service");
    await assignRandomSetToParticipant(session, existingByIdentity);
    return finalizeParticipantJoin(session, existingByIdentity, {
      isReturning: true,
      payload: joinPayload
    });
  }

  if (joinPayload.device_fingerprint && !wantsFreshParticipantIdentity(joinPayload)) {
    const existingByDevice = await findParticipantByDeviceFingerprint(
      session.session_id,
      joinPayload.device_fingerprint
    );
    const wantsFreshIdentity =
      Boolean(joinPayload.nickname || joinPayload.avatar_url) &&
      session.join_type !== "name_email";
    if (existingByDevice && !wantsFreshIdentity) {
      assertSessionAcceptingJoin(session, { isReturning: true });
      const { assignRandomSetToParticipant } = require("./question-set.service");
      await assignRandomSetToParticipant(session, existingByDevice);
      return finalizeParticipantJoin(session, existingByDevice, {
        isReturning: true,
        payload: joinPayload
      });
    }
  }

  assertSessionAcceptingJoin(session, { isReturning: false });
  await assertNewParticipantMayJoin(session);
  await assertParticipantCapacity(session);

  if (session.join_type === "name_email") {
    const email = normalizeParticipantEmail(joinPayload.email);
    const nickname = normalizeParticipantNickname(joinPayload.nickname);
    if (!email || !nickname) {
      const error = new Error("Name and email are required to join this session");
      error.statusCode = 400;
      throw error;
    }
  }

  const isAnonymous = resolveParticipantAnonymous(session, joinPayload);
  const nickname = isAnonymous
    ? await nextAnonymousNickname(session.session_id)
    : joinPayload.nickname || null;
  const email =
    session.join_type === "name_email" && joinPayload.email
      ? normalizeParticipantEmail(joinPayload.email)
      : joinPayload.email || null;

  const participant = await Participant.create({
    session_id: session.session_id,
    dept_id: session.dept_id,
    nickname,
    email,
    avatar_url: joinPayload.avatar_url || null,
    is_anonymous: isAnonymous,
    device_fingerprint: joinPayload.device_fingerprint || null,
    session_state: null
  });

  const { assignRandomSetToParticipant } = require("./question-set.service");
  await assignRandomSetToParticipant(session, participant);

  return finalizeParticipantJoin(session, participant, {
    isReturning: false,
    payload: joinPayload
  });
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
  duplicateSession,
  getSessionById,
  updateSession,
  archiveSession,
  resetSessionResponses,
  endSessionBySystem,
  transitionSessionStatus,
  getSessionByCode,
  getSessionJoinBlockInfo,
  joinSession,
  listSessionParticipants,
  getSessionQr,
  assertSessionWriteAccess,
  getSessionOrThrow
};
