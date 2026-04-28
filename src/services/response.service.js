const {
  Response,
  Question,
  QuestionOption,
  Session,
  Participant,
  Department,
  Client
} = require("../models");

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

  const existing = await Response.findOne({
    where: {
      question_id: question.question_id,
      participant_id: participant.participant_id
    }
  });
  if (existing) {
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
    rating_value: input.rating_value || null,
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
  }

  const created = await Response.create(responsePayload);

  if (question.is_quiz_mode && created.points_earned > 0) {
    await Participant.increment(
      { score: created.points_earned },
      { where: { participant_id: participant.participant_id } }
    );
  }

  return created;
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

  return Question.findAll({
    where: { session_id: sessionId },
    include: [{ model: QuestionOption }],
    order: [
      ["display_order", "ASC"],
      [QuestionOption, "display_order", "ASC"]
    ]
  });
}

module.exports = {
  submitResponse,
  getQuestionResults,
  getSessionResponses,
  getSessionSummary,
  exportSessionResponsesCsv,
  listParticipantQuestionsService
};
