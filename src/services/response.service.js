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
const { notifyLeaderboard, notifyRankingResponseSubmitted } = require("./websocket.service");

function participantDisplayName(participant, participantId) {
  const p = participant?.participant ?? participant?.Participant ?? participant;
  if (!p || typeof p !== "object") {
    return `Participant ${participantId}`;
  }
  const nickname = String(p.nickname || "").trim();
  if (nickname) return nickname;
  const email = String(p.email || "").trim();
  if (email) return email;
  if (p.is_anonymous) return "Anonymous";
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

function buildRankingAnalytics(question, responses) {
  const options = (question.QuestionOptions || question.question_options || [])
    .map((opt) => ({
      option_id: Number(opt.option_id),
      option_text: opt.option_text
    }))
    .filter((opt) => Number.isFinite(opt.option_id));
  if (!options.length) return null;

  const optionMap = new Map();
  options.forEach((opt) => {
    optionMap.set(opt.option_id, {
      optionId: opt.option_id,
      optionText: opt.option_text,
      totalScore: 0,
      totalRankSum: 0,
      totalResponses: 0,
      firstPlaceCount: 0,
      secondPlaceCount: 0,
      thirdPlaceCount: 0,
      lastPlaceCount: 0,
      rankCounts: {}
    });
  });

  const totalOptions = options.length;
  let validResponses = 0;
  for (const row of responses || []) {
    const order = Array.isArray(row.ranking_order) ? row.ranking_order.map(Number) : [];
    if (order.length !== totalOptions) continue;
    const uniqueOrder = [...new Set(order)];
    if (uniqueOrder.length !== totalOptions) continue;
    if (!uniqueOrder.every((id) => optionMap.has(id))) continue;
    validResponses += 1;

    uniqueOrder.forEach((optionId, idx) => {
      const rankPosition = idx + 1;
      const score = totalOptions - rankPosition + 1;
      const bucket = optionMap.get(optionId);
      bucket.totalScore += score;
      bucket.totalRankSum += rankPosition;
      bucket.totalResponses += 1;
      bucket.rankCounts[rankPosition] = (bucket.rankCounts[rankPosition] || 0) + 1;
      if (rankPosition === 1) bucket.firstPlaceCount += 1;
      if (rankPosition === 2) bucket.secondPlaceCount += 1;
      if (rankPosition === 3) bucket.thirdPlaceCount += 1;
      if (rankPosition === totalOptions) bucket.lastPlaceCount += 1;
    });
  }

  const rankings = Array.from(optionMap.values())
    .map((row) => {
      const averageScore = row.totalResponses
        ? Number((row.totalScore / row.totalResponses).toFixed(2))
        : 0;
      const averageRank = row.totalResponses
        ? Number((row.totalRankSum / row.totalResponses).toFixed(2))
        : 0;
      const rankDistributionPercentage = {};
      for (let rank = 1; rank <= totalOptions; rank += 1) {
        const rankCount = Number(row.rankCounts[rank] || 0);
        rankDistributionPercentage[rank] = validResponses
          ? Number(((rankCount / validResponses) * 100).toFixed(2))
          : 0;
      }
      return {
        optionId: row.optionId,
        optionText: row.optionText,
        totalScore: row.totalScore,
        averageScore,
        averageRank,
        firstPlaceCount: row.firstPlaceCount,
        secondPlaceCount: row.secondPlaceCount,
        thirdPlaceCount: row.thirdPlaceCount,
        lastPlaceCount: row.lastPlaceCount,
        rankDistributionPercentage
      };
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      if (a.averageRank !== b.averageRank) return a.averageRank - b.averageRank;
      if (b.firstPlaceCount !== a.firstPlaceCount) return b.firstPlaceCount - a.firstPlaceCount;
      return a.optionText.localeCompare(b.optionText);
    })
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return {
    totalResponses: validResponses,
    totalOptions,
    rankings
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
  if (user?.role === "presenter_viewer") {
    if (Number(user.session_id) === Number(session.session_id)) return;
    const error = new Error("Forbidden: response access denied");
    error.statusCode = 403;
    throw error;
  }
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
  if (question.question_type === "survey") return false;
  return Number(question.time_limit_seconds) > 0;
}

function normalizeQuestionFormatType(type) {
  return String(type || "").trim().toLowerCase();
}

function getEffectiveQuestionType(question) {
  if (question.question_type === "survey") {
    return normalizeQuestionFormatType(question.survey_subtype || "mcq");
  }
  return normalizeQuestionFormatType(question.question_type);
}

function supportsMultipleOptionSelection(question) {
  if (!question.allow_multiple_select) return false;
  const effectiveType = getEffectiveQuestionType(question);
  return ["mcq", "poll"].includes(effectiveType);
}

function isNonScoredQuestion(question) {
  return (
    question.question_type === "poll" ||
    question.question_type === "survey" ||
    !question.is_quiz_mode
  );
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
  if (question.submissions_closed) {
    const error = new Error("This question is closed and no longer accepting submissions");
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
  const effectiveType = getEffectiveQuestionType(question);
  const nonScored = isNonScoredQuestion(question);

  if (Array.isArray(input.option_ids) && input.option_ids.length > 0) {
    if (!supportsMultipleOptionSelection(question)) {
      const error = new Error(
        question.allow_multiple_select
          ? "Multiple option selections are only supported for MCQ and poll questions"
          : "Multiple selections are not allowed for this question"
      );
      error.statusCode = 400;
      throw error;
    }

    const optionIds = [
      ...new Set(input.option_ids.map(Number).filter((id) => Number.isFinite(id) && id > 0))
    ];
    const validIds = new Set(
      (question.QuestionOptions || question.question_options || [])
        .map((opt) => Number(opt.option_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    if (!optionIds.length || !optionIds.every((id) => validIds.has(id))) {
      const error = new Error("Invalid option selection");
      error.statusCode = 400;
      throw error;
    }

    await Response.destroy({
      where: {
        question_id: question.question_id,
        participant_id: participant.participant_id
      }
    });

    const rows = await Response.bulkCreate(
      optionIds.map((optionId) => ({
        session_id: question.session_id,
        dept_id: question.dept_id,
        question_id: question.question_id,
        participant_id: participant.participant_id,
        option_id: optionId,
        text_response: null,
        rating_value: null,
        ranking_order: null,
        is_correct: null,
        points_earned: 0,
        response_time_ms: input.response_time_ms || null,
        submitted_at: new Date()
      }))
    );

    return { response: rows[0], created: true };
  }

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

  if (effectiveType === "rating") {
    const min = Number(question.rating_min ?? 1);
    const max = Number(question.rating_max ?? 5);
    const rating = Number(responsePayload.rating_value);
    if (!Number.isFinite(rating) || rating < min || rating > max) {
      const error = new Error(`Rating must be between ${min} and ${max}`);
      error.statusCode = 400;
      throw error;
    }
  }

  if (effectiveType === "ranking") {
    const optionIds = (question.QuestionOptions || question.question_options || [])
      .map((opt) => Number(opt.option_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const rankingOrder = Array.isArray(input.ranking_order) ? input.ranking_order.map(Number) : [];
    const uniqueOrder = [...new Set(rankingOrder)];
    if (
      optionIds.length < 2 ||
      uniqueOrder.length !== optionIds.length ||
      !optionIds.every((id) => uniqueOrder.includes(id))
    ) {
      const error = new Error("Ranking responses must include every option exactly once");
      error.statusCode = 400;
      throw error;
    }
    responsePayload.option_id = null;
    responsePayload.text_response = null;
    responsePayload.rating_value = null;
    responsePayload.ranking_order = uniqueOrder;
  }

  if (responsePayload.option_id) {
    const option = await QuestionOption.findByPk(Number(responsePayload.option_id));
    if (!option || Number(option.question_id) !== Number(question.question_id)) {
      const error = new Error("Invalid option for question");
      error.statusCode = 400;
      throw error;
    }
    if (nonScored) {
      responsePayload.is_correct = null;
      responsePayload.points_earned = 0;
    } else if (question.is_quiz_mode) {
      responsePayload.is_correct = Boolean(option.is_correct);
      responsePayload.points_earned = option.is_correct ? Number(question.points_value || 0) : 0;
    }
  } else if (nonScored || question.is_quiz_mode) {
    responsePayload.is_correct = null;
    responsePayload.points_earned = 0;
  }

  let saved;
  let created = false;

  if (existing && (!timed || question.open_for_reattempt)) {
    const oldPoints = nonScored ? 0 : Number(existing.points_earned || 0);
    const newPoints = nonScored ? 0 : Number(responsePayload.points_earned || 0);
    await existing.update({
      ...responsePayload,
      submitted_at: new Date()
    });
    saved = existing;
    const delta = newPoints - oldPoints;
    if (!nonScored && question.is_quiz_mode && delta !== 0) {
      await Participant.increment({ score: delta }, { where: { participant_id: participant.participant_id } });
    }
  } else {
    created = true;
    saved = await Response.create(responsePayload);
    if (!nonScored && question.is_quiz_mode && Number(saved.points_earned || 0) > 0) {
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

    if (effectiveType === "ranking") {
      const rankingResponses = await Response.findAll({
        where: { question_id: question.question_id },
        attributes: ["ranking_order"]
      });
      const analytics = buildRankingAnalytics(question, rankingResponses);
      if (analytics) {
        notifyRankingResponseSubmitted(session.session_code, {
          questionId: question.question_id,
          totalResponses: analytics.totalResponses,
          rankings: analytics.rankings,
          analytics
        });
      }
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

function buildQuestionResultsPayload(question, responses) {
  const effectiveType = getEffectiveQuestionType(question);
  const total = responses.length;
  const byOption = {};
  responses.forEach((row) => {
    if (row.option_id) {
      const key = String(row.option_id);
      byOption[key] = (byOption[key] || 0) + 1;
    }
  });

  const ratingResponses = responses.filter((row) => row.rating_value != null);
  let ratingDistribution = null;
  if (effectiveType === "rating") {
    const min = Number(question.rating_min ?? 1);
    const max = Number(question.rating_max ?? 10);
    ratingDistribution = {};
    for (let value = min; value <= max; value += 1) {
      ratingDistribution[value] = 0;
    }
    ratingResponses.forEach((row) => {
      const value = Number(row.rating_value);
      if (value >= min && value <= max) {
        ratingDistribution[value] += 1;
      }
    });
  }

  return {
    question_id: question.question_id,
    question_type: question.question_type,
    survey_subtype: question.survey_subtype || null,
    effective_type: effectiveType,
    total_responses: total,
    by_option: byOption,
    word_counts:
      effectiveType === "word_cloud" ? aggregateWordCloudCounts(responses) : null,
    average_rating:
      effectiveType === "rating" && ratingResponses.length > 0
        ? Number(
            (
              ratingResponses.reduce((sum, row) => sum + Number(row.rating_value || 0), 0) /
              ratingResponses.length
            ).toFixed(2)
          )
        : null,
    rating_distribution: ratingDistribution,
    ranking_analytics:
      effectiveType === "ranking" ? buildRankingAnalytics(question, responses) : null
  };
}

async function loadQuestionWithResponses(questionId) {
  const question = await Question.findByPk(questionId, {
    include: [{ model: QuestionOption }]
  });
  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }

  const responses = await Response.findAll({
    where: { question_id: questionId },
    include: [{ model: QuestionOption, attributes: ["option_id", "option_text", "display_order"] }],
    order: [["submitted_at", "ASC"]]
  });

  return { question, responses };
}

async function getQuestionResults({ questionId, user }) {
  const question = await Question.findByPk(questionId, {
    include: [{ model: Session }, { model: QuestionOption }]
  });
  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }
  const session = await getSessionForAccess(question.session_id);
  assertStaffAccess(user, session);

  const { question: loadedQuestion, responses } = await loadQuestionWithResponses(questionId);
  return buildQuestionResultsPayload(loadedQuestion, responses);
}

function questionAllowsParticipantAggregateResults(question) {
  if (question.question_type === "poll" || question.question_type === "rating") return true;
  if (question.question_type === "survey") {
    return getEffectiveQuestionType(question) !== "open_text";
  }
  return false;
}

async function getParticipantSurveyQuestionResults({ questionId, participant }) {
  const { question, responses } = await loadQuestionWithResponses(questionId);

  if (!questionAllowsParticipantAggregateResults(question)) {
    const error = new Error("Results are not available for this question type");
    error.statusCode = 400;
    throw error;
  }

  if (Number(participant.session_id) !== Number(question.session_id)) {
    const error = new Error("Not allowed for this session");
    error.statusCode = 403;
    throw error;
  }

  const hasSubmitted = await Response.findOne({
    where: {
      question_id: questionId,
      participant_id: participant.participant_id
    },
    attributes: ["response_id"]
  });

  if (!hasSubmitted) {
    const error = new Error("Submit your response before viewing results");
    error.statusCode = 403;
    throw error;
  }

  if (!question.show_leaderboard) {
    const error = new Error("Results are not visible yet");
    error.statusCode = 403;
    throw error;
  }

  return buildQuestionResultsPayload(question, responses);
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
  const session = await getSessionForAccess(sessionId);
  assertStaffAccess(user, session);

  const [rows, questions] = await Promise.all([
    getSessionResponses({ sessionId, user }),
    Question.findAll({
      where: { session_id: sessionId },
      attributes: ["question_id", "question_text", "question_type", "survey_subtype"]
    })
  ]);

  const questionsById = new Map(questions.map((q) => [Number(q.question_id), q]));

  const header = [
    "response_id",
    "question_id",
    "question_text",
    "question_type",
    "survey_sub_type",
    "participant_id",
    "nickname",
    "option_id",
    "option_text",
    "text_response",
    "rating_value",
    "points_earned",
    "submitted_at"
  ];

  const csvRows = rows.map((row) => {
    const question = questionsById.get(Number(row.question_id));
    const isSurvey = question?.question_type === "survey";
    const surveySubType = isSurvey ? question.survey_subtype || "" : "";
    const pointsEarned = isSurvey ? "" : row.points_earned ?? 0;

    return [
      row.response_id,
      row.question_id,
      question?.question_text || row.question?.question_text || "",
      question?.question_type || row.question?.question_type || "",
      surveySubType,
      row.participant_id,
      row.participant?.nickname || "",
      row.option_id || "",
      row.question_option?.option_text || "",
      row.text_response || "",
      row.rating_value ?? "",
      pointsEarned,
      row.submitted_at ? new Date(row.submitted_at).toISOString() : ""
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",");
  });

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

  let submittedQuestionIds = new Set();
  if (participant?.participant_id && questions.length) {
    const rows = await Response.findAll({
      where: {
        participant_id: participant.participant_id,
        question_id: questions.map((q) => q.question_id)
      },
      attributes: ["question_id"]
    });
    submittedQuestionIds = new Set(rows.map((row) => Number(row.question_id)));
  }

  return questions.map((q) =>
    formatQuestionForParticipant(q, {
      participantSubmitted: submittedQuestionIds.has(Number(q.question_id))
    })
  );
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
  getParticipantSurveyQuestionResults,
  getSessionResponses,
  getSessionSummary,
  exportSessionResponsesCsv,
  listParticipantQuestionsService,
  getParticipantSessionLeaderboard,
  buildQuestionLeaderboard,
  buildSessionLeaderboard,
  buildRankingAnalytics,
  aggregateWordCloudCounts,
  getSessionForAccess,
  assertStaffAccess,
  getEffectiveQuestionType,
  isNonScoredQuestion
};
