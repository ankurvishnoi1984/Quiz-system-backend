const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Question, QuestionSet, Participant, Session } = require("../models");

function sessionAccess() {
  return require("./session.service");
}

const MAX_SETS_PER_SESSION = 12;
const SET_NAME_MAX = 80;

function nextDefaultSetName(existingNames) {
  const used = new Set(
    (existingNames || []).map((name) => String(name || "").trim().toLowerCase())
  );
  for (let i = 0; i < 26; i += 1) {
    const name = `Set ${String.fromCharCode(65 + i)}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  let n = 1;
  while (used.has(`set ${n}`)) n += 1;
  return `Set ${n}`;
}

function serializeSet(row, questionCount = 0) {
  return {
    set_id: row.set_id,
    session_id: row.session_id,
    name: row.name,
    display_order: row.display_order,
    question_count: Number(questionCount) || 0
  };
}

async function listQuestionSets({ sessionId, user }) {
  const { getSessionOrThrow, assertSessionWriteAccess } = sessionAccess();
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);

  const sets = await QuestionSet.findAll({
    where: { session_id: sessionId },
    order: [
      ["display_order", "ASC"],
      ["set_id", "ASC"]
    ]
  });

  const counts = await Question.findAll({
    where: { session_id: sessionId },
    attributes: ["set_id", [sequelize.fn("COUNT", sequelize.col("question_id")), "question_count"]],
    group: ["set_id"],
    raw: true
  });
  const countBySet = new Map(
    counts
      .filter((row) => row.set_id != null)
      .map((row) => [Number(row.set_id), Number(row.question_count)])
  );

  return sets.map((row) => serializeSet(row, countBySet.get(Number(row.set_id)) || 0));
}

async function listQuestionSetsForSession(sessionId) {
  return QuestionSet.findAll({
    where: { session_id: sessionId },
    order: [
      ["display_order", "ASC"],
      ["set_id", "ASC"]
    ]
  });
}

async function createQuestionSet({ sessionId, user, name }) {
  const { getSessionOrThrow, assertSessionWriteAccess } = sessionAccess();
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  if (session.status !== "draft") {
    const error = new Error("Question sets can be created only for draft sessions");
    error.statusCode = 400;
    throw error;
  }
  if (session.participant_navigation_enabled === false) {
    const error = new Error("Question sets are only available when participants can move between questions");
    error.statusCode = 400;
    throw error;
  }

  const existing = await QuestionSet.findAll({
    where: { session_id: sessionId },
    attributes: ["set_id", "name", "display_order"]
  });
  if (existing.length >= MAX_SETS_PER_SESSION) {
    const error = new Error(`A session can have at most ${MAX_SETS_PER_SESSION} question sets`);
    error.statusCode = 400;
    throw error;
  }

  const trimmed = typeof name === "string" ? name.trim().slice(0, SET_NAME_MAX) : "";
  const nextName = trimmed || nextDefaultSetName(existing.map((row) => row.name));
  const nextOrder =
    existing.reduce((max, row) => Math.max(max, Number(row.display_order) || 0), 0) + 1;

  const created = await QuestionSet.create({
    session_id: session.session_id,
    name: nextName,
    display_order: nextOrder
  });
  return serializeSet(created, 0);
}

async function updateQuestionSet({ sessionId, setId, user, name }) {
  const { getSessionOrThrow, assertSessionWriteAccess } = sessionAccess();
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  if (session.status !== "draft") {
    const error = new Error("Question sets can be renamed only for draft sessions");
    error.statusCode = 400;
    throw error;
  }

  const row = await QuestionSet.findOne({
    where: { set_id: setId, session_id: sessionId }
  });
  if (!row) {
    const error = new Error("Question set not found");
    error.statusCode = 404;
    throw error;
  }

  const trimmed = typeof name === "string" ? name.trim().slice(0, SET_NAME_MAX) : "";
  if (!trimmed) {
    const error = new Error("Set name is required");
    error.statusCode = 400;
    throw error;
  }
  row.name = trimmed;
  await row.save();
  const count = await Question.count({ where: { session_id: sessionId, set_id: setId } });
  return serializeSet(row, count);
}

async function deleteQuestionSet({ sessionId, setId, user }) {
  const { getSessionOrThrow, assertSessionWriteAccess } = sessionAccess();
  const session = await getSessionOrThrow(sessionId);
  assertSessionWriteAccess(user, session);
  if (session.status !== "draft") {
    const error = new Error("Question sets can be deleted only for draft sessions");
    error.statusCode = 400;
    throw error;
  }

  const row = await QuestionSet.findOne({
    where: { set_id: setId, session_id: sessionId }
  });
  if (!row) {
    const error = new Error("Question set not found");
    error.statusCode = 404;
    throw error;
  }

  await Question.update(
    { set_id: null },
    { where: { session_id: sessionId, set_id: setId } }
  );
  await row.destroy();
  return { deleted: true, set_id: Number(setId) };
}

async function listNonemptySetIds(sessionId, transaction) {
  const rows = await Question.findAll({
    where: {
      session_id: sessionId,
      set_id: { [Op.ne]: null }
    },
    attributes: ["set_id"],
    group: ["set_id"],
    raw: true,
    transaction
  });
  return [
    ...new Set(
      rows
        .map((row) => Number(row.set_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  ];
}

/**
 * Assign a set when the session has questions in sets and this participant
 * does not already have one. Returning joiners keep their set.
 *
 * Picks among the least-used nonempty sets (random among ties) so 2–3 testers
 * don't all land on Set A by chance.
 */
async function assignRandomSetToParticipant(session, participant) {
  if (!session || !participant) return participant;
  if (session.participant_navigation_enabled === false) return participant;
  if (participant.assigned_set_id) return participant;
  if (!participant.participant_id) return participant;

  await sequelize.transaction(async (t) => {
    const locked = await Participant.findByPk(participant.participant_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!locked) return;
    if (locked.assigned_set_id) {
      participant.assigned_set_id = Number(locked.assigned_set_id);
      return;
    }

    await Session.findByPk(session.session_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const nonemptyIds = await listNonemptySetIds(session.session_id, t);
    if (!nonemptyIds.length) return;

    const usageRows = await Participant.findAll({
      where: {
        session_id: session.session_id,
        assigned_set_id: { [Op.in]: nonemptyIds },
        participant_id: { [Op.ne]: locked.participant_id }
      },
      attributes: ["assigned_set_id"],
      raw: true,
      transaction: t
    });

    const usedBySet = new Map(nonemptyIds.map((id) => [id, 0]));
    for (const row of usageRows) {
      const id = Number(row.assigned_set_id);
      if (usedBySet.has(id)) usedBySet.set(id, usedBySet.get(id) + 1);
    }

    const min = Math.min(...usedBySet.values());
    const leastUsed = nonemptyIds.filter((id) => usedBySet.get(id) === min);
    const picked = leastUsed[Math.floor(Math.random() * leastUsed.length)];

    await locked.update({ assigned_set_id: picked }, { transaction: t });
    participant.assigned_set_id = picked;
  });

  return participant;
}

function participantCanAccessQuestion(participant, question) {
  if (!participant || !question) return false;
  if (Number(participant.session_id) !== Number(question.session_id)) return false;
  if (!question.set_id) return true;
  if (!participant.assigned_set_id) return false;
  return Number(participant.assigned_set_id) === Number(question.set_id);
}

module.exports = {
  listQuestionSets,
  listQuestionSetsForSession,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  assignRandomSetToParticipant,
  participantCanAccessQuestion,
  MAX_SETS_PER_SESSION
};
