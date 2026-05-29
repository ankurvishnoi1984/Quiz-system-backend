const {
  Response,
  Question,
  QuestionOption,
  Session,
  Participant,
  Department,
  Client
} = require("../models");
const { formatQuestionForParticipant } = require("./question.service");
const { notifyLeaderboard } = require("./websocket.service");

function participantDisplayName(participant, participantId) {
  const p = participant?.participant ?? participant?.Participant ?? participant;
  if (!p || typeof p !== "object") {
    return `Participant ${participantId}`;
  }
  if (p.is_anonymous) {
    return "Anonymous";
  }
  const nickname = String(p.nickname || "").trim();
  if (nickname) return nickname;
  const email = String(p.email || "").trim();
  if (email) return email;
  return `Participant ${participantId}`;
}

function toLeaderboardEntry(participantId, displayName, score) {
  return {
    participant_id: participantId,
    nickname: displayName,
    name: displayName,
    score
  };
}

async function buildSessionLeaderboard(sessionId, limit = 10) {
  const rows = await Participant.findAll({
    where: { session_id: sessionId },
    attributes: ["participant_id", "nickname", "email", "is_anonymous", "score"],
    order: [["score", "DESC"]],
    limit
  });
  return rows.map((p) =>
    toLeaderboardEntry(
      p.participant_id,
      participantDisplayName(p, p.participant_id),
      p.score || 0
    )
  );
}

async function buildQuestionLeaderboard(questionId, limit = 10) {
  const rows = await Response.findAll({
    where: { question_id: questionId },
    include: [
      {
        model: Participant,
        attributes: ["participant_id", "nickname", "email", "is_anonymous"]
      }
    ],
    order: [["points_earned", "DESC"], ["submitted_at", "ASC"]],
    limit: 50
  });
  const byParticipant = new Map();
  rows.forEach((row) => {
    const pid = row.participant_id;
    const points = Number(row.points_earned || 0);
    const displayName = participantDisplayName(row, pid);
    const existing = byParticipant.get(pid);
    if (!existing || points > existing.score) {
      byParticipant.set(pid, toLeaderboardEntry(pid, displayName, points));
    }
  });
  return Array.from(byParticipant.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function assertStaffAccess(user, session) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(session.department.client_id)) {
    return;
  }
  if (user.role === "dept_admin" && Number(user.dept_id) === Number(session.dept_id)) return;
  if (user.role === "host" && Number(user.user_id) === Number(session.host_id)) return;
  const error = new Error("Forbidden: response access denied");
  error.statusCode = 403;
  throw error;
}

async function getSessionForAccess(sessionId) {
  const session = await Session.findByPk(sessionId, {
    include: [{ model: Department, include: [{ model: Client, attributes: ["client_id"] }] }]
  });
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  return session;
}

function isQuestionTimed(question) {
  return Number(question.time_limit_seconds) > 0;
}

async function submitResponse({ participant, input }) {
  const question = await Question.findByPk(Number(input.question_id), {
    include: [{ model: QuestionOption }]
  });
  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }

  if (Number(question.session_id) !== Number(participant.session_id)) {
    const error = new Error("Question does not belong to participant session");
    error.statusCode = 403;
    throw error;
  }
  if (!question.is_live) {
    const error = new Error("Question is not active");
    error.statusCode = 400;
    throw error;
  }

  const session = await Session.findByPk(Number(participant.session_id));
  if (!session || (session.status !== "live" && session.status !== "paused")) {
    const error = new Error("Session is not accepting responses");
    error.statusCode = 400;
    throw error;
  }

  const timed = isQuestionTimed(question);

  const existing = await Response.findOne({
    where: {
      question_id: question.question_id,
      participant_id: participant.participant_id
    }
  });
  if (existing && timed && !question.open_for_reattempt) {
    const error = new Error("Response already submitted for this question");
    error.statusCode = 409;
    throw error;
  }

  const responsePayload = {
    session_id: question.session_id,
    dept_id: question.dept_id,
    question_id: question.question_id,
    participant_id: participant.participant_id,
    option_id: input.option_id || null,
    text_response: input.text_response || null,
    rating_value: input.rating_value != null ? input.rating_value : null,
    ranking_order: input.ranking_order || null,
    response_time_ms: input.response_time_ms || null
  };

  if (responsePayload.option_id) {
    const option = await QuestionOption.findByPk(Number(responsePayload.option_id));
    if (!option || Number(option.question_id) !== Number(question.question_id)) {
      const error = new Error("Invalid option for question");
      error.statusCode = 400;
      throw error;
    }
    if (question.is_quiz_mode) {
      responsePayload.is_correct = Boolean(option.is_correct);
      responsePayload.points_earned = option.is_correct ? Number(question.points_value || 0) : 0;
    }
  } else if (question.is_quiz_mode) {
    responsePayload.is_correct = null;
    responsePayload.points_earned = 0;
  }

  let saved;
  let created = false;

  if (existing && (!timed || question.open_for_reattempt)) {
    const oldPoints = question.is_quiz_mode ? Number(existing.points_earned || 0) : 0;
    const newPoints = question.is_quiz_mode ? Number(responsePayload.points_earned || 0) : 0;
    await existing.update({
      ...responsePayload,
      submitted_at: new Date()
    });
    saved = existing;
    const delta = newPoints - oldPoints;
    if (question.is_quiz_mode && delta !== 0) {
      await Participant.increment({ score: delta }, { where: { participant_id: participant.participant_id } });
    }
  } else {
    created = true;
    saved = await Response.create(responsePayload);
    if (question.is_quiz_mode && Number(saved.points_earned || 0) > 0) {
      await Participant.increment(
        { score: saved.points_earned },
        { where: { participant_id: participant.participant_id } }
      );
    }
  }

  if (session?.session_code) {
    const payload = {
      leaderboard: [],
      question_id: question.question_id,
      question_leaderboard: null
    };

    if (session.leaderboard_enabled) {
      payload.leaderboard = await buildSessionLeaderboard(question.session_id);
    }

    if (question.show_leaderboard && question.is_quiz_mode) {
      payload.question_leaderboard = await buildQuestionLeaderboard(question.question_id);
    }

    if (payload.leaderboard.length || payload.question_leaderboard?.length) {
      notifyLeaderboard(session.session_code, payload);
    }
  }

  return { response: saved, created };
}

function aggregateWordCloudCounts(responses) {
  const byKey = new Map();
  for (const row of responses) {
    if (!row.text_response) continue;
    const parts = String(row.text_response).split(",");
    for (const part of parts) {
      const word = part.trim();
      if (!word) continue;
      const key = word.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, { text: word, count: 1 });
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

async function getQuestionResults({ questionId, user }) {
  const question = await Question.findByPk(questionId, { include: [{ model: Session }] });
  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }
  const session = await getSessionForAccess(question.session_id);
  assertStaffAccess(user, session);

  const responses = await Response.findAll({
    where: { question_id: questionId },
    include: [{ model: QuestionOption, attributes: ["option_id", "option_text", "display_order"] }],
    order: [["submitted_at", "ASC"]]
  });

  const total = responses.length;
  const byOption = {};
  responses.forEach((row) => {
    if (row.option_id) {
      const key = String(row.option_id);
      byOption[key] = (byOption[key] || 0) + 1;
    }
  });

  return {
    question_id: question.question_id,
    question_type: question.question_type,
    total_responses: total,
    by_option: byOption,
    word_counts:
      question.question_type === "word_cloud" ? aggregateWordCloudCounts(responses) : null,
    average_rating:
      question.question_type === "rating" && total > 0
        ? Number(
            (
              responses.reduce((sum, row) => sum + Number(row.rating_value || 0), 0) / total
            ).toFixed(2)
          )
        : null
  };
}

async function getSessionResponses({ sessionId, user }) {
  const session = await getSessionForAccess(sessionId);
  assertStaffAccess(user, session);
  return Response.findAll({
    where: { session_id: sessionId },
    include: [
      { model: Participant, attributes: ["participant_id", "nickname"] },
      { model: Question, attributes: ["question_id", "question_text", "question_type"] },
      { model: QuestionOption, attributes: ["option_id", "option_text"] }
    ],
    order: [["submitted_at", "DESC"]]
  });
}

async function getSessionSummary({ sessionId, user }) {
  const session = await getSessionForAccess(sessionId);
  assertStaffAccess(user, session);

  const [participantCount, responseCount, uniqueResponders, questionCount] = await Promise.all([
    Participant.count({ where: { session_id: sessionId } }),
    Response.count({ where: { session_id: sessionId } }),
    Response.count({
      distinct: true,
      col: "participant_id",
      where: { session_id: sessionId }
    }),
    Question.count({ where: { session_id: sessionId } })
  ]);

  return {
    session_id: Number(sessionId),
    total_participants: participantCount,
    total_responses: responseCount,
    total_questions: questionCount,
    active_responders: uniqueResponders,
    response_rate_percent:
      participantCount > 0 ? Number(((uniqueResponders / participantCount) * 100).toFixed(2)) : 0
  };
}

async function exportSessionResponsesCsv({ sessionId, user }) {
  const rows = await getSessionResponses({ sessionId, user });
  const header = [
    "response_id",
    "question_id",
    "question_text",
    "participant_id",
    "nickname",
    "option_id",
    "option_text",
    "text_response",
    "rating_value",
    "points_earned",
    "submitted_at"
  ];
  const csvRows = rows.map((row) =>
    [
      row.response_id,
      row.question_id,
      row.question?.question_text || "",
      row.participant_id,
      row.participant?.nickname || "",
      row.option_id || "",
      row.question_option?.option_text || "",
      row.text_response || "",
      row.rating_value || "",
      row.points_earned || 0,
      row.submitted_at ? new Date(row.submitted_at).toISOString() : ""
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  return [header.join(","), ...csvRows].join("\n");
}

async function getSessionForQuestionFlow(sessionId) {
  const session = await Session.findByPk(sessionId, {
    include: [{ model: Department }]
  });
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  return session;
}

async function listParticipantQuestionsService({ sessionId, participant }) {
  const session = await getSessionForQuestionFlow(sessionId);

  if (participant && Number(participant.session_id) !== Number(sessionId)) {
    const error = new Error("Access denied to this session");
    error.statusCode = 403;
    throw error;
  }

  let questions = await Question.findAll({
    where: { session_id: sessionId, is_live: true },
    include: [{ model: QuestionOption }],
    order: [
      ["display_order", "ASC"],
      [QuestionOption, "display_order", "ASC"]
    ]
  });

  return questions.map(formatQuestionForParticipant);
}

async function getParticipantSessionLeaderboard({ sessionId, participant }) {
  const session = await Session.findByPk(sessionId, {
    attributes: ["session_id", "leaderboard_enabled"]
  });
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  if (Number(participant.session_id) !== Number(sessionId)) {
    const error = new Error("Not allowed for this session");
    error.statusCode = 403;
    throw error;
  }
  if (!session.leaderboard_enabled) {
    return [];
  }
  return buildSessionLeaderboard(sessionId);
}

module.exports = {
  submitResponse,
  getQuestionResults,
  getSessionResponses,
  getSessionSummary,
  exportSessionResponsesCsv,
  listParticipantQuestionsService,
  getParticipantSessionLeaderboard,
  buildQuestionLeaderboard,
  buildSessionLeaderboard
};
