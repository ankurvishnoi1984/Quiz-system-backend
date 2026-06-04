const { Op } = require("sequelize");
const {
  Question,
  QuestionOption,
  Session,
  Department,
  Client,
  User
} = require("../models");

function isParticipantNavigationEnabled(session) {
  return session.participant_navigation_enabled !== false;
}

/** When navigation is off, only one question may be live per session. */
async function deactivateOtherLiveQuestions(session, activeQuestionId) {
  if (isParticipantNavigationEnabled(session)) {
    return [];
  }

  const others = await Question.findAll({
    where: {
      session_id: session.session_id,
      is_live: true,
      question_id: { [Op.ne]: Number(activeQuestionId) }
    },
    attributes: ["question_id"]
  });

  const deactivatedQuestionIds = others.map((row) => row.question_id);
  if (!deactivatedQuestionIds.length) {
    return [];
  }

  await Question.update(
    {
      is_live: false,
      open_for_reattempt: false,
      answer_revealed: false,
      show_leaderboard: false,
      live_activated_at: null,
      submissions_closed: false
    },
    {
      where: {
        session_id: session.session_id,
        question_id: deactivatedQuestionIds
      }
    }
  );

  return deactivatedQuestionIds;
}

function assertScopeAccess(user, sessionWithDept) {
  if (user.role === "super_admin") return;
  if (
    user.role === "client_admin" &&
    Number(user.client_id) === Number(sessionWithDept.department.client_id)
  ) {
    return;
  }
  if (user.role === "dept_admin" && Number(user.dept_id) === Number(sessionWithDept.dept_id)) {
    return;
  }
  if (user.role === "host" && Number(user.user_id) === Number(sessionWithDept.host_id)) {
    return;
  }
  const error = new Error("Forbidden: question access denied");
  error.statusCode = 403;
  throw error;
}

async function getSessionForQuestionFlow(sessionId) {
  const session = await Session.findByPk(sessionId, {
    include: [
      {
        model: Department,
        include: [{ model: Client, attributes: ["client_id", "name", "slug"] }]
      },
      { model: User, attributes: ["user_id", "full_name", "role"] }
    ]
  });
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  return session;
}

async function listSessionQuestions({ sessionId, user, publicView = false }) {
  const session = await getSessionForQuestionFlow(sessionId);

  if (!publicView && user) {
    assertScopeAccess(user, session);
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

async function createQuestion({ sessionId, input, user }) {
  const session = await getSessionForQuestionFlow(sessionId);
  assertScopeAccess(user, session);

  if (session.status !== "draft") {
    const error = new Error("Questions can be created only for draft sessions");
    error.statusCode = 400;
    throw error;
  }

  const nextOrder = (await Question.count({ where: { session_id: sessionId } })) + 1;

  const isPoll = input.question_type === "poll";

  const question = await Question.create({
    session_id: session.session_id,
    dept_id: session.dept_id,
    question_type: input.question_type,
    question_text: input.question_text,
    media_url: input.media_url || null,
    media_type: input.media_type || null,
    media_thumbnail_url: input.media_thumbnail_url || null,
    is_quiz_mode: isPoll ? false : input.is_quiz_mode ?? false,
    points_value: isPoll ? 0 : input.points_value || 10,
    time_limit_seconds: input.time_limit_seconds || null,
    allow_multiple_select: input.allow_multiple_select ?? false,
    rating_min: input.rating_min || 1,
    rating_max: input.rating_max || 5,
    rating_min_label: input.rating_min_label || null,
    rating_max_label: input.rating_max_label || null,
    is_live: false,
    show_leaderboard: false,
    display_order: input.display_order || nextOrder
  });

  if (Array.isArray(input.options) && input.options.length > 0) {
    const optionsToCreate = input.options.map((option, idx) => ({
      question_id: question.question_id,
      option_text: option.option_text,
      media_url: option.media_url || null,
      is_correct: isPoll ? false : option.is_correct ?? false,
      display_order: option.display_order || idx + 1
    }));
    await QuestionOption.bulkCreate(optionsToCreate);
  }

  return Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function getQuestionById({ questionId, user }) {
  const question = await Question.findByPk(questionId, {
    include: [{ model: QuestionOption }, { model: Session, include: [Department] }]
  });
  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }
  const fullSession = await getSessionForQuestionFlow(question.session_id);
  assertScopeAccess(user, fullSession);
  return question;
}

async function updateQuestion({ questionId, input, user }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);
  const isDraft = session.status === "draft";

  if (isDraft) {
    const nextType =
      input.question_type !== undefined ? input.question_type : question.question_type;
    const isPoll = nextType === "poll";

    Object.assign(question, {
      question_type: nextType,
      question_text:
        input.question_text !== undefined ? input.question_text : question.question_text,
      media_url: input.media_url !== undefined ? input.media_url : question.media_url,
      media_type: input.media_type !== undefined ? input.media_type : question.media_type,
      media_thumbnail_url:
        input.media_thumbnail_url !== undefined
          ? input.media_thumbnail_url
          : question.media_thumbnail_url,
      is_quiz_mode: isPoll
        ? false
        : input.is_quiz_mode !== undefined
          ? Boolean(input.is_quiz_mode)
          : question.is_quiz_mode,
      points_value: isPoll
        ? 0
        : input.points_value !== undefined
          ? input.points_value
          : question.points_value,
      time_limit_seconds:
        input.time_limit_seconds !== undefined
          ? input.time_limit_seconds
          : question.time_limit_seconds,
      allow_multiple_select:
        input.allow_multiple_select !== undefined
          ? Boolean(input.allow_multiple_select)
          : question.allow_multiple_select,
      rating_min: input.rating_min !== undefined ? input.rating_min : question.rating_min,
      rating_max: input.rating_max !== undefined ? input.rating_max : question.rating_max,
      rating_min_label:
        input.rating_min_label !== undefined
          ? input.rating_min_label
          : question.rating_min_label,
      rating_max_label:
        input.rating_max_label !== undefined
          ? input.rating_max_label
          : question.rating_max_label
    });

    await question.save();

    if (Array.isArray(input.options)) {
      await QuestionOption.destroy({ where: { question_id: question.question_id } });
      const optionsToCreate = input.options.map((option, idx) => ({
        question_id: question.question_id,
        option_text: option.option_text,
        media_url: option.media_url || null,
        is_correct: isPoll ? false : option.is_correct ?? false,
        display_order: option.display_order || idx + 1
      }));
      if (optionsToCreate.length > 0) {
        await QuestionOption.bulkCreate(optionsToCreate);
      }
    }

    return getQuestionById({ questionId, user });
  }

  // Live / paused / completed / archived: only question text + option text; correctness is immutable
  if (input.question_text !== undefined) {
    question.question_text = input.question_text;
    await question.save();
  }

  if (Array.isArray(input.options) && input.options.length > 0) {
    const existing = await QuestionOption.findAll({
      where: { question_id: question.question_id },
      order: [
        ["display_order", "ASC"],
        ["option_id", "ASC"]
      ]
    });
    if (input.options.length !== existing.length) {
      const error = new Error("Cannot add or remove answer options while the session is not in draft");
      error.statusCode = 400;
      throw error;
    }
    for (let i = 0; i < existing.length; i += 1) {
      const ex = existing[i];
      const inc = input.options.find(
        (o) => o && o.option_id != null && Number(o.option_id) === Number(ex.option_id)
      );
      if (!inc || typeof inc !== "object") {
        const error = new Error(
          "Each option must include option_id matching the existing answers when the session is not in draft"
        );
        error.statusCode = 400;
        throw error;
      }
      if (Boolean(inc.is_correct) !== Boolean(ex.is_correct)) {
        const error = new Error("Cannot change which option is correct after the session has gone live");
        error.statusCode = 400;
        throw error;
      }
      const nextText = inc.option_text !== undefined ? inc.option_text : ex.option_text;
      await ex.update({ option_text: nextText });
    }
  }

  return getQuestionById({ questionId, user });
}

async function deleteQuestion({ questionId, user }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);
  if (session.status !== "draft") {
    const error = new Error("Only draft-session questions can be deleted");
    error.statusCode = 400;
    throw error;
  }
  await QuestionOption.destroy({ where: { question_id: question.question_id } });
  await question.destroy();
}

async function reorderQuestions({ sessionId, orderedIds, user }) {
  const session = await getSessionForQuestionFlow(sessionId);
  assertScopeAccess(user, session);
  if (session.status !== "draft") {
    const error = new Error("Questions can be reordered only in draft sessions");
    error.statusCode = 400;
    throw error;
  }

  const questions = await Question.findAll({ where: { session_id: sessionId } });
  const knownIds = new Set(questions.map((q) => q.question_id));
  const isValid = orderedIds.every((id) => knownIds.has(Number(id)));
  if (!isValid || orderedIds.length !== questions.length) {
    const error = new Error("orderedIds must contain all session question IDs exactly once");
    error.statusCode = 400;
    throw error;
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      Question.update(
        { display_order: index + 1 },
        {
          where: {
            question_id: Number(id),
            session_id: sessionId
          }
        }
      )
    )
  );

  return listSessionQuestions({ sessionId, user });
}

async function setQuestionLiveState({ questionId, user, isLive }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);
  if (session.status !== "live" && isLive) {
    const error = new Error("Question can be activated only in live sessions");
    error.statusCode = 400;
    throw error;
  }

  let deactivatedQuestionIds = [];
  if (Boolean(isLive)) {
    deactivatedQuestionIds = await deactivateOtherLiveQuestions(session, question.question_id);
  }

  question.is_live = Boolean(isLive);
  if (Boolean(isLive)) {
    question.live_activated_at = new Date();
    question.submissions_closed = false;
  } else {
    question.open_for_reattempt = false;
    question.answer_revealed = false;
    question.show_leaderboard = false;
    question.live_activated_at = null;
    question.submissions_closed = false;
  }
  await question.save();
  const saved = await Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
  return { question: saved, deactivatedQuestionIds };
}

function getQuestionOptions(question) {
  return question.QuestionOptions || question.question_options || [];
}

function getCorrectOptionIds(question) {
  return getQuestionOptions(question)
    .filter((option) => Boolean(option.is_correct))
    .map((option) => Number(option.option_id));
}

function formatQuestionForParticipant(question, { participantSubmitted = false } = {}) {
  const plain = question.toJSON ? question.toJSON() : { ...question };
  const revealed = Boolean(plain.answer_revealed);
  const rawOptions = plain.QuestionOptions || plain.question_options || [];

  const question_options = rawOptions.map((option) => ({
    option_id: option.option_id,
    option_text: option.option_text,
    media_url: option.media_url || null,
    display_order: option.display_order
  }));

  const correct_option_ids =
    revealed && participantSubmitted
      ? getQuestionOptions(plain)
          .filter((option) => Boolean(option.is_correct))
          .map((option) => Number(option.option_id))
      : [];

  return {
    ...plain,
    QuestionOptions: undefined,
    question_options,
    answer_revealed: revealed,
    correct_option_ids,
    show_leaderboard: Boolean(plain.show_leaderboard),
    live_activated_at: plain.live_activated_at || null,
    submissions_closed: Boolean(plain.submissions_closed),
    open_for_reattempt: Boolean(plain.open_for_reattempt)
  };
}

async function setQuestionAnswerRevealed({ questionId, user, revealed }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);

  if (!["mcq", "true_false"].includes(question.question_type)) {
    const error = new Error("Answers can be revealed only for multiple choice or true/false questions");
    error.statusCode = 400;
    throw error;
  }

  if (!question.is_quiz_mode) {
    const error = new Error("Answers can be revealed only for quiz mode questions");
    error.statusCode = 400;
    throw error;
  }

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Answers can be revealed only while the session is live");
    error.statusCode = 400;
    throw error;
  }

  question.answer_revealed = Boolean(revealed);
  await question.save();

  return Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function setQuestionLeaderboardVisibility({ questionId, user, visible }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);

  if (!question.is_quiz_mode) {
    const error = new Error("Leaderboard can be shown only for quiz mode questions");
    error.statusCode = 400;
    throw error;
  }

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Leaderboard visibility can be changed only while the session is live");
    error.statusCode = 400;
    throw error;
  }

  question.show_leaderboard = Boolean(visible);
  await question.save();

  return Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function closeQuestionSubmissions({ questionId, user }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Question can be closed only while the session is live");
    error.statusCode = 400;
    throw error;
  }

  if (isParticipantNavigationEnabled(session)) {
    const error = new Error(
      "Close question is only available in single active question mode"
    );
    error.statusCode = 400;
    throw error;
  }

  if (Number(question.time_limit_seconds) > 0) {
    const error = new Error("Close question is only available for untimed questions");
    error.statusCode = 400;
    throw error;
  }

  if (!question.is_live) {
    const error = new Error("Only a live question can be closed");
    error.statusCode = 400;
    throw error;
  }

  if (question.submissions_closed) {
    const error = new Error("Question is already closed");
    error.statusCode = 400;
    throw error;
  }

  question.submissions_closed = true;
  await question.save();

  return Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function activateAllQuestionsForSession({ sessionId, user }) {
  const session = await getSessionForQuestionFlow(sessionId);
  assertScopeAccess(user, session);

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Questions can be activated only while the session is live");
    error.statusCode = 400;
    throw error;
  }

  if (!isParticipantNavigationEnabled(session)) {
    const error = new Error(
      "Activate all questions is only available in multiple active question mode"
    );
    error.statusCode = 400;
    throw error;
  }

  const sessionQuestions = await Question.findAll({
    where: { session_id: sessionId },
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });

  if (!sessionQuestions.length) {
    const error = new Error("No questions in this session");
    error.statusCode = 400;
    throw error;
  }

  const toActivate = sessionQuestions.filter((q) => !q.is_live);
  if (!toActivate.length) {
    const error = new Error("All questions are already active");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const questionIds = toActivate.map((q) => q.question_id);
  await Question.update(
    {
      is_live: true,
      live_activated_at: now,
      submissions_closed: false,
      open_for_reattempt: false,
      answer_revealed: false,
      show_leaderboard: false
    },
    { where: { session_id: sessionId, question_id: questionIds } }
  );

  return Question.findAll({
    where: { question_id: questionIds },
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function closeAllQuestionSubmissionsForSession({ sessionId, user }) {
  const session = await getSessionForQuestionFlow(sessionId);
  assertScopeAccess(user, session);

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Questions can be closed only while the session is live");
    error.statusCode = 400;
    throw error;
  }

  if (!isParticipantNavigationEnabled(session)) {
    const error = new Error(
      "Close all questions is only available in multiple active question mode"
    );
    error.statusCode = 400;
    throw error;
  }

  const liveQuestions = await Question.findAll({
    where: { session_id: sessionId, is_live: true },
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });

  const timedLive = liveQuestions.filter((q) => Number(q.time_limit_seconds) > 0);
  if (timedLive.length > 0) {
    const error = new Error("Close all questions is only available for untimed sessions");
    error.statusCode = 400;
    throw error;
  }

  const toClose = liveQuestions.filter((q) => !q.submissions_closed);
  if (!toClose.length) {
    const error = new Error(
      liveQuestions.length
        ? "All live questions are already closed"
        : "No live questions to close"
    );
    error.statusCode = 400;
    throw error;
  }

  const questionIds = toClose.map((q) => q.question_id);
  await Question.update(
    { submissions_closed: true },
    { where: { session_id: sessionId, question_id: questionIds } }
  );

  return Question.findAll({
    where: { question_id: questionIds },
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function openQuestionForReattempt({ questionId, user }) {
  const question = await getQuestionById({ questionId, user });
  const session = await getSessionForQuestionFlow(question.session_id);

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Reattempt can be opened only while the session is live");
    error.statusCode = 400;
    throw error;
  }

  const deactivatedQuestionIds = await deactivateOtherLiveQuestions(
    session,
    question.question_id
  );

  question.is_live = true;
  question.open_for_reattempt = true;
  question.submissions_closed = false;
  question.answer_revealed = false;
  question.show_leaderboard = false;
  question.live_activated_at = new Date();
  await question.save();

  const saved = await Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });

  return { question: saved, deactivatedQuestionIds };
}

module.exports = {
  listSessionQuestions,
  createQuestion,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  setQuestionLiveState,
  setQuestionAnswerRevealed,
  setQuestionLeaderboardVisibility,
  closeQuestionSubmissions,
  closeAllQuestionSubmissionsForSession,
  activateAllQuestionsForSession,
  openQuestionForReattempt,
  getCorrectOptionIds,
  formatQuestionForParticipant
};
