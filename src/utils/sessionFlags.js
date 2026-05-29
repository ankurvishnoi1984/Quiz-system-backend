const { Op } = require("sequelize");
const { Question } = require("../models");

/** DB/Sequelize may return 0/1; never use `value !== false` for booleans. */
function participantNavigationEnabled(value) {
  if (value === undefined || value === null) return true;
  return Boolean(value);
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
  participantNavigationEnabled,
  sessionHasTimedQuestions,
  isStrictLateJoinSession,
  sessionHasTimedQuestionsInDb
};
