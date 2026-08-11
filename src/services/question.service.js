const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  Question,
  QuestionOption,
  QuestionSet,
  Session,
  Department,
  Client,
  User
} = require("../models");
const { isSessionQuizTotalTimeEnabled } = require("../utils/sessionFlags");
const { validateCreateQuestionPayload } = require("../validators/question.validator");

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

async function resolveQuestionSetId(sessionId, setId) {
  if (setId === undefined) return undefined;
  if (setId === null || setId === "") return null;
  const id = Number(setId);
  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error("set_id must be a number");
    error.statusCode = 400;
    throw error;
  }
  const row = await QuestionSet.findOne({
    where: { set_id: id, session_id: sessionId },
    attributes: ["set_id"]
  });
  if (!row) {
    const error = new Error("Question set not found in this session");
    error.statusCode = 400;
    throw error;
  }
  return id;
}

async function listSessionQuestions({ sessionId, user, publicView = false }) {
  const session = await getSessionForQuestionFlow(sessionId);

  if (!publicView && user) {
    assertScopeAccess(user, session);
  }

  return Question.findAll({
    where: { session_id: sessionId },
    include: [
      { model: QuestionOption },
      { model: QuestionSet, as: "set", attributes: ["set_id", "name", "display_order"], required: false }
    ],
    order: [
      [{ model: QuestionSet, as: "set" }, "display_order", "ASC"],
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
  const setId = await resolveQuestionSetId(sessionId, input.set_id);

  const isPoll = input.question_type === "poll";
  const isSurvey = input.question_type === "survey";
  const isEmojiReaction = input.question_type === "emoji_reaction";
  const isNonScored = isPoll || isSurvey || isEmojiReaction;

  const question = await Question.create({
    session_id: session.session_id,
    dept_id: session.dept_id,
    question_type: input.question_type,
    question_text: input.question_text,
    media_url: input.media_url || null,
    media_type: input.media_type || null,
    media_thumbnail_url: input.media_thumbnail_url || null,
    is_quiz_mode: isNonScored ? false : input.is_quiz_mode ?? false,
    points_value: isNonScored ? 0 : input.points_value || 10,
    time_limit_seconds: isSurvey ? null : input.time_limit_seconds || null,
    allow_multiple_select: isEmojiReaction ? false : input.allow_multiple_select ?? false,
    survey_subtype: isSurvey ? input.survey_subtype || null : null,
    rating_min: input.rating_min ?? 1,
    rating_max: input.rating_max ?? 10,
    rating_min_label: input.rating_min_label || null,
    rating_max_label: input.rating_max_label || null,
    is_live: false,
    show_leaderboard: false,
    display_order: input.display_order || nextOrder,
    set_id: setId === undefined ? null : setId
  });

  if (Array.isArray(input.options) && input.options.length > 0) {
    const optionsToCreate = input.options.map((option, idx) => ({
      question_id: question.question_id,
      option_text: option.option_text,
      media_url: option.media_url || null,
      is_correct: isNonScored ? false : option.is_correct ?? false,
      display_order: option.display_order || idx + 1
    }));
    await QuestionOption.bulkCreate(optionsToCreate);
  }

  return Question.findByPk(question.question_id, {
    include: [{ model: QuestionOption, order: [["display_order", "ASC"]] }]
  });
}

async function validateQuestionImport({ sessionId, questions, mode = "append", user }) {
  const session = await getSessionForQuestionFlow(sessionId);
  assertScopeAccess(user, session);

  if (session.status !== "draft") {
    const error = new Error("Questions can be imported only into draft sessions");
    error.statusCode = 400;
    throw error;
  }
  if (!["append", "replace"].includes(mode)) {
    const error = new Error("Import mode must be append or replace");
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    const error = new Error("At least one question is required");
    error.statusCode = 400;
    throw error;
  }
  if (questions.length > 500) {
    const error = new Error("A single import can contain at most 500 questions");
    error.statusCode = 400;
    throw error;
  }

  const rowErrors = questions.map((question, index) => ({
    row: question.__row || index + 2,
    errors: validateCreateQuestionPayload(question)
  }));

  const importedTypes = new Set(questions.map((question) => question.question_type));
  if (importedTypes.size !== 1) {
    rowErrors.forEach((row) => {
      row.errors.push(
        "All imported questions must use one top-level question_type (Survey may mix survey_subtype)"
      );
    });
  }

  if (mode === "append") {
    const existingTypes = await Question.findAll({
      where: { session_id: sessionId },
      attributes: ["question_type"],
      group: ["question_type"],
      raw: true
    });
    const importedType = questions[0]?.question_type;
    if (
      existingTypes.length > 0 &&
      (existingTypes.length !== 1 || existingTypes[0].question_type !== importedType)
    ) {
      rowErrors.forEach((row) => {
        row.errors.push(
          `Append import must match the existing session type (${existingTypes
            .map((entry) => entry.question_type)
            .join(", ")})`
        );
      });
    }
  }

  return {
    session,
    rows: rowErrors.map((row) => ({
      ...row,
      errors: [...new Set(row.errors)],
      valid: row.errors.length === 0
    })),
    valid: rowErrors.every((row) => row.errors.length === 0)
  };
}

async function importQuestions({ sessionId, questions, mode = "append", user }) {
  const validation = await validateQuestionImport({ sessionId, questions, mode, user });
  if (!validation.valid) {
    const error = new Error("Import validation failed");
    error.statusCode = 400;
    error.details = validation.rows;
    throw error;
  }

  const createdCount = await sequelize.transaction(async (transaction) => {
    if (mode === "replace") {
      const existing = await Question.findAll({
        where: { session_id: sessionId },
        attributes: ["question_id"],
        transaction
      });
      const existingIds = existing.map((question) => question.question_id);
      if (existingIds.length) {
        await QuestionOption.destroy({
          where: { question_id: existingIds },
          transaction
        });
        await Question.destroy({
          where: { question_id: existingIds, session_id: sessionId },
          transaction
        });
      }
    }

    const currentMax =
      mode === "replace"
        ? 0
        : Number(
            (await Question.max("display_order", {
              where: { session_id: sessionId },
              transaction
            })) || 0
          );

    for (let index = 0; index < questions.length; index += 1) {
      const input = questions[index];
      const isPoll = input.question_type === "poll";
      const isSurvey = input.question_type === "survey";
      const isEmojiReaction = input.question_type === "emoji_reaction";
      const isNonScored = isPoll || isSurvey || isEmojiReaction;
      const question = await Question.create(
        {
          session_id: validation.session.session_id,
          dept_id: validation.session.dept_id,
          question_type: input.question_type,
          question_text: input.question_text,
          media_url: input.media_url || null,
          media_type: input.media_type || null,
          media_thumbnail_url: input.media_thumbnail_url || null,
          is_quiz_mode: isNonScored ? false : input.is_quiz_mode ?? false,
          points_value: isNonScored ? 0 : input.points_value || 10,
          time_limit_seconds:
            isSurvey || isSessionQuizTotalTimeEnabled(validation.session)
              ? null
              : input.time_limit_seconds || null,
          allow_multiple_select: isEmojiReaction
            ? false
            : input.allow_multiple_select ?? false,
          survey_subtype: isSurvey ? input.survey_subtype || null : null,
          rating_min: input.rating_min ?? 1,
          rating_max: input.rating_max ?? 10,
          rating_min_label: input.rating_min_label || null,
          rating_max_label: input.rating_max_label || null,
          is_live: false,
          show_leaderboard: false,
          display_order: currentMax + index + 1
        },
        { transaction }
      );

      if (Array.isArray(input.options) && input.options.length) {
        await QuestionOption.bulkCreate(
          input.options.map((option, optionIndex) => ({
            question_id: question.question_id,
            option_text: option.option_text,
            media_url: option.media_url || null,
            is_correct: isNonScored ? false : option.is_correct ?? false,
            display_order: optionIndex + 1
          })),
          { transaction }
        );
      }
    }
    return questions.length;
  });

  return {
    created_count: createdCount,
    mode,
    questions: await listSessionQuestions({ sessionId, user })
  };
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
    const isSurvey = nextType === "survey";
    const isEmojiReaction = nextType === "emoji_reaction";
    const isNonScored = isPoll || isSurvey || isEmojiReaction;

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
      is_quiz_mode: isNonScored
        ? false
        : input.is_quiz_mode !== undefined
          ? Boolean(input.is_quiz_mode)
          : question.is_quiz_mode,
      points_value: isNonScored
        ? 0
        : input.points_value !== undefined
          ? input.points_value
          : question.points_value,
      time_limit_seconds: isSurvey
        ? null
        : input.time_limit_seconds !== undefined
          ? input.time_limit_seconds
          : question.time_limit_seconds,
      survey_subtype: isSurvey
        ? input.survey_subtype !== undefined
          ? input.survey_subtype
          : question.survey_subtype
        : null,
      allow_multiple_select: isEmojiReaction
        ? false
        : input.allow_multiple_select !== undefined
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

    if (input.set_id !== undefined) {
      question.set_id = await resolveQuestionSetId(question.session_id, input.set_id);
    }

    await question.save();

    if (Array.isArray(input.options)) {
      await QuestionOption.destroy({ where: { question_id: question.question_id } });
      const optionsToCreate = input.options.map((option, idx) => ({
        question_id: question.question_id,
        option_text: option.option_text,
        media_url: option.media_url || null,
        is_correct: isNonScored ? false : option.is_correct ?? false,
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
  if (isSessionQuizTotalTimeEnabled(session)) {
    const error = new Error(
      "Question activation is managed automatically for quiz total time sessions"
    );
    error.statusCode = 400;
    throw error;
  }
  if (session.status !== "live" && isLive) {
    const error = new Error("Question can be activated only in live sessions");
    error.statusCode = 400;
    throw error;
  }
  if (isLive) {
    // With question sets, each participant only sees their assigned set, so activating a single
    // question would leave other sets' participants with nothing. Force all-or-nothing activation.
    const setQuestionCount = await Question.count({
      where: { session_id: session.session_id, set_id: { [Op.ne]: null } }
    });
    if (setQuestionCount > 0) {
      const error = new Error(
        "This session uses question sets. Use \"Activate all questions\" so every set goes live together."
      );
      error.statusCode = 400;
      throw error;
    }
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
  const isSurvey = question.question_type === "survey";
  const isPoll = question.question_type === "poll";
  const isRating = question.question_type === "rating";
  const isEmojiReaction = question.question_type === "emoji_reaction";

  if (!question.is_quiz_mode && !isSurvey && !isPoll && !isRating && !isEmojiReaction) {
    const error = new Error("Results can be shown only for quiz, poll, rating, or survey questions");
    error.statusCode = 400;
    throw error;
  }

  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Result visibility can be changed only while the session is live");
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

  if (isSessionQuizTotalTimeEnabled(session)) {
    const error = new Error(
      "All questions are activated automatically when a quiz total time session is launched"
    );
    error.statusCode = 400;
    throw error;
  }

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

/** Quiz total time: make every question live when the host launches the session. */
async function ensureAllQuestionsLiveForQuizTotalTimeSession(session) {
  if (!isSessionQuizTotalTimeEnabled(session)) return [];

  const inactive = await Question.findAll({
    where: { session_id: session.session_id, is_live: false },
    attributes: ["question_id"]
  });
  if (!inactive.length) return [];

  const now = new Date();
  const questionIds = inactive.map((q) => q.question_id);
  await Question.update(
    {
      is_live: true,
      live_activated_at: now,
      submissions_closed: false,
      open_for_reattempt: false,
      answer_revealed: false,
      show_leaderboard: false
    },
    { where: { session_id: session.session_id, question_id: questionIds } }
  );

  return questionIds;
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
  validateQuestionImport,
  importQuestions,
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
  ensureAllQuestionsLiveForQuizTotalTimeSession,
  openQuestionForReattempt,
  getCorrectOptionIds,
  formatQuestionForParticipant
};
