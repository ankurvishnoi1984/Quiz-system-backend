const { QaQuestion, QaUpvote, Session, Department, Client, Participant } = require("../models");

function assertStaffAccess(user, session) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(session.department.client_id)) {
    return;
  }
  if (user.role === "dept_admin" && Number(user.dept_id) === Number(session.dept_id)) return;
  if (user.role === "host" && Number(user.user_id) === Number(session.host_id)) return;
  const error = new Error("Forbidden: Q&A access denied");
  error.statusCode = 403;
  throw error;
}

async function getSessionOrThrow(sessionId) {
  const session = await Session.findByPk(Number(sessionId), {
    include: [{ model: Department, include: [{ model: Client, attributes: ["client_id"] }] }]
  });
  if (!session) {
    const error = new Error("Session not found");
    error.statusCode = 404;
    throw error;
  }
  return session;
}

async function getQaOrThrow(qaId) {
  const qa = await QaQuestion.findByPk(Number(qaId));
  if (!qa) {
    const error = new Error("Q&A question not found");
    error.statusCode = 404;
    throw error;
  }
  return qa;
}

async function listQaQuestionsForStaff({ sessionId, user }) {
  const session = await getSessionOrThrow(sessionId);
  assertStaffAccess(user, session);
  return QaQuestion.findAll({
    where: { session_id: Number(sessionId) },
    include: [{ model: Participant, attributes: ["participant_id", "nickname"] }],
    order: [
      ["is_pinned", "DESC"],
      ["upvotes", "DESC"],
      ["created_at", "DESC"]
    ]
  });
}

async function listQaQuestionsForParticipant({ sessionId, participant }) {
  if (Number(participant.session_id) !== Number(sessionId)) {
    const error = new Error("Participant cannot access this session");
    error.statusCode = 403;
    throw error;
  }
  return QaQuestion.findAll({
    where: {
      session_id: Number(sessionId),
      status: ["approved", "answered", "pinned"]
    },
    include: [{ model: Participant, attributes: ["participant_id", "nickname"] }],
    order: [
      ["is_pinned", "DESC"],
      ["upvotes", "DESC"],
      ["created_at", "DESC"]
    ]
  });
}

async function askQuestion({ sessionId, participant, input }) {
  if (Number(participant.session_id) !== Number(sessionId)) {
    const error = new Error("Participant cannot ask in this session");
    error.statusCode = 403;
    throw error;
  }

  const session = await getSessionOrThrow(sessionId);
  if (session.status !== "live" && session.status !== "paused") {
    const error = new Error("Q&A is available only during active sessions");
    error.statusCode = 400;
    throw error;
  }

  return QaQuestion.create({
    session_id: Number(sessionId),
    dept_id: session.dept_id,
    participant_id: participant.participant_id,
    question_text: input.question_text.trim(),
    is_anonymous: input.is_anonymous ?? false,
    status: "pending",
    is_pinned: false
  });
}

async function upvoteQuestion({ qaId, participant }) {
  const qa = await getQaOrThrow(qaId);
  if (Number(qa.session_id) !== Number(participant.session_id)) {
    const error = new Error("Participant cannot upvote this question");
    error.statusCode = 403;
    throw error;
  }

  const existing = await QaUpvote.findOne({
    where: { qa_id: qa.qa_id, participant_id: participant.participant_id }
  });
  if (!existing) {
    await QaUpvote.create({
      qa_id: qa.qa_id,
      participant_id: participant.participant_id
    });
    qa.upvotes = Number(qa.upvotes || 0) + 1;
    await qa.save();
  }
  return qa;
}

async function removeUpvote({ qaId, participant }) {
  const qa = await getQaOrThrow(qaId);
  if (Number(qa.session_id) !== Number(participant.session_id)) {
    const error = new Error("Participant cannot remove upvote on this question");
    error.statusCode = 403;
    throw error;
  }

  const deleted = await QaUpvote.destroy({
    where: { qa_id: qa.qa_id, participant_id: participant.participant_id }
  });
  if (deleted > 0) {
    qa.upvotes = Math.max(0, Number(qa.upvotes || 0) - 1);
    await qa.save();
  }
  return qa;
}

async function moderateQuestion({ qaId, action, user, isPinned }) {
  const qa = await getQaOrThrow(qaId);
  const session = await getSessionOrThrow(qa.session_id);
  assertStaffAccess(user, session);

  if (action === "approve") qa.status = "approved";
  if (action === "reject") qa.status = "rejected";
  if (action === "answer") {
    qa.status = "answered";
    qa.answered_by = user.user_id;
    qa.answered_at = new Date();
  }
  if (action === "pin") {
    const nextPinned = isPinned !== undefined ? Boolean(isPinned) : !Boolean(qa.is_pinned);
    qa.is_pinned = nextPinned;
    qa.status = nextPinned ? "pinned" : qa.status === "pinned" ? "approved" : qa.status;
  }

  await qa.save();
  return qa;
}

module.exports = {
  listQaQuestionsForStaff,
  listQaQuestionsForParticipant,
  askQuestion,
  upvoteQuestion,
  removeUpvote,
  moderateQuestion
};
