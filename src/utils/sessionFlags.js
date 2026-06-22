const { Op } = require("sequelize");
const { Question } = require("../models");

const MULTI_NAV_TIMED_JOIN_CLOSED_MESSAGE = "Session has already started";

function isSessionQuizTotalTimeEnabled(session) {
  if (!session) return false;
  const minutes = Number(session?.quiz_total_time_minutes);
  return (
    participantNavigationEnabled(session?.participant_navigation_enabled) &&
    Number.isFinite(minutes) &&
    minutes > 0
  );
}

/** DB/Sequelize may return 0/1; never use `value !== false` for booleans. */
function participantNavigationEnabled(value) {
  if (value === undefined || value === null) return true;
  return Boolean(value);
}

function parseActivationTime(value) {
  if (value == null || value === "") return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < Date.UTC(2020, 0, 1)) return null;
  return ms;
}

function isQuestionLiveFlag(value) {
  return value === true || value === 1;
}

function getFirstTimedQuestion(questions = []) {
  return (
    [...questions]
      .filter((q) => Number(q?.time_limit_seconds ?? 0) > 0)
      .sort((a, b) => {
        const orderDiff = Number(a?.display_order ?? 0) - Number(b?.display_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return Number(a?.question_id ?? 0) - Number(b?.question_id ?? 0);
      })[0] ?? null
  );
}

function isTimedQuestionExpired(question, now = Date.now()) {
  const limit = Number(question?.time_limit_seconds ?? 0);
  if (limit <= 0) return false;
  const activated = parseActivationTime(question?.live_activated_at);
  if (activated == null) return false;
  return now >= activated + limit * 1000;
}

/**
 * Multi-question navigation + timed: block new joins once the first timed question's
 * host window has expired (participant missed the session start).
 */
function isMultiNavTimedJoinClosed(session, questions = []) {
  if (!participantNavigationEnabled(session?.participant_navigation_enabled)) return false;
  if (!sessionHasTimedQuestions(questions)) return false;

  const firstTimed = getFirstTimedQuestion(questions);
  if (!firstTimed || !isQuestionLiveFlag(firstTimed.is_live)) return false;
  if (!firstTimed.live_activated_at) return false;

  return isTimedQuestionExpired(firstTimed);
}

function sessionHasTimedQuestions(questions = []) {
  return (questions || []).some(
    (q) => Number(q?.time_limit_seconds ?? 0) > 0
  );
}

/**
 * Strict late join: host activation clock, remaining time only.
 * Applies when single active question mode and the session has timed questions.
 * @param {object} session
 * @param {Array|boolean} [questionsOrHasTimed] Question list, or boolean from DB lookup.
 */
function isStrictLateJoinSession(session, questionsOrHasTimed = []) {
  if (isSessionQuizTotalTimeEnabled(session)) return false;
  if (session?.participant_navigation_enabled !== false) return false;
  if (typeof questionsOrHasTimed === "boolean") return questionsOrHasTimed;
  return sessionHasTimedQuestions(questionsOrHasTimed);
}

async function sessionHasTimedQuestionsInDb(sessionId) {
  const row = await Question.findOne({
    where: {
      session_id: sessionId,
      time_limit_seconds: { [Op.gt]: 0 }
    },
    attributes: ["question_id"]
  });
  return Boolean(row);
}

module.exports = {
  MULTI_NAV_TIMED_JOIN_CLOSED_MESSAGE,
  participantNavigationEnabled,
  isSessionQuizTotalTimeEnabled,
  sessionHasTimedQuestions,
  isStrictLateJoinSession,
  sessionHasTimedQuestionsInDb,
  getFirstTimedQuestion,
  isMultiNavTimedJoinClosed
};
