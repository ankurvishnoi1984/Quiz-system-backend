const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const activeConnections = new Map();

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const sessionCode = url.searchParams.get("session");
    const role = url.searchParams.get("role");

    if (!sessionCode) {
      ws.close(4000, "Session code required");
      return;
    }

    let decoded = null;
    if (token) {
      try {
        decoded = jwt.verify(token, env.jwtSecret);
      } catch {
        // Continue without auth for anon participants
      }
    }

    const connectionKey = `${sessionCode}:${role || "participant"}`;
    if (!activeConnections.has(connectionKey)) {
      activeConnections.set(connectionKey, new Set());
    }
    activeConnections.get(connectionKey).add(ws);

    ws.sessionCode = sessionCode;
    ws.role = role || "participant";
    ws.user = decoded;

    ws.on("close", () => {
      const connSet = activeConnections.get(connectionKey);
      if (connSet) {
        connSet.delete(ws);
        if (connSet.size === 0) {
          activeConnections.delete(connectionKey);
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error.message);
    });

    send(ws, { type: "connected", session: sessionCode, role: ws.role });
  });

  return wss;
}

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(sessionCode, role, data) {
  const connectionKey = `${sessionCode}:${role}`;
  const connSet = activeConnections.get(connectionKey);
  if (!connSet) return;

  const payload = JSON.stringify(data);
  connSet.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(payload);
    }
  });
}

function broadcastToSession(sessionCode, data, excludeWs = null) {
  const payload = JSON.stringify(data);
  activeConnections.forEach((connSet, key) => {
    if (key.startsWith(`${sessionCode}:`)) {
      connSet.forEach((ws) => {
        if (ws !== excludeWs && ws.readyState === 1) {
          ws.send(payload);
        }
      });
    }
  });
}

async function broadcastResponse({ sessionCode, sessionId, response }) {
  const results = await getLiveResults(sessionId, response.question_id);
  broadcastToSession(sessionCode, {
    type: "response_received",
    response: {
      question_id: response.question_id,
      participant_id: response.participant_id,
      option_id: response.option_id,
      text_response: response.text_response
    },
    results
  });
}

async function getLiveResults(sessionId, questionId) {
  const { Question, QuestionOption, Response: ResponseModel } = require("../models");

  const question = await Question.findByPk(questionId, {
    include: [{ model: QuestionOption }]
  });
  if (!question) return null;

  const responses = await ResponseModel.findAll({
    where: { session_id: sessionId, question_id: questionId }
  });

  const total = responses.length;
  const byOption = {};
  const textResponses = [];

  responses.forEach((row) => {
    if (row.option_id) {
      const key = String(row.option_id);
      byOption[key] = (byOption[key] || 0) + 1;
    }
    if (row.text_response) {
      textResponses.push(row.text_response);
    }
  });

  let average = null;
  if (question.question_type === "rating") {
    const sum = responses.reduce((acc, r) => acc + (r.rating_value || 0), 0);
    average = total > 0 ? Number((sum / total).toFixed(2)) : null;
  }

  return {
    question_id: question.question_id,
    question_type: question.question_type,
    total_responses: total,
    by_option: byOption,
    text_responses: textResponses.slice(-50),
    average_rating: average
  };
}

async function getSessionProgress(sessionId) {
  const { Participant, Question, Response: ResponseModel } = require("../models");
  const [participantsCount, questionCount] = await Promise.all([
    Participant.count({ where: { session_id: sessionId } }),
    Question.count({ where: { session_id: sessionId } })
  ]);

  if (participantsCount === 0 || questionCount === 0) {
    return {
      participants_count: participantsCount,
      completed_participants: 0,
      completion_progress: 0
    };
  }

  const responses = await ResponseModel.findAll({
    where: { session_id: sessionId },
    attributes: ["participant_id", "question_id"]
  });

  const uniqueQuestionSets = new Map();
  responses.forEach((row) => {
    const key = Number(row.participant_id);
    if (!uniqueQuestionSets.has(key)) uniqueQuestionSets.set(key, new Set());
    uniqueQuestionSets.get(key).add(Number(row.question_id));
  });

  let completedParticipants = 0;
  uniqueQuestionSets.forEach((qSet) => {
    if (qSet.size >= questionCount) completedParticipants += 1;
  });

  return {
    participants_count: participantsCount,
    completed_participants: completedParticipants,
    completion_progress: Math.round((completedParticipants / participantsCount) * 100)
  };
}

function notifySessionUpdate(sessionCode, status) {
  broadcastToSession(sessionCode, {
    type: "session_updated",
    status
  });
}

function notifyQuestionChange(sessionCode, currentQuestion, isLive) {
  broadcastToSession(sessionCode, {
    type: "question_changed",
    question_id: currentQuestion,
    is_live: isLive
  });
}

function notifyLeaderboard(sessionCode, leaderboard) {
  broadcastToSession(sessionCode, {
    type: "leaderboard_update",
    leaderboard
  });
}

async function notifySessionProgress(sessionCode, sessionId) {
  const progress = await getSessionProgress(sessionId);
  broadcastToSession(sessionCode, {
    type: "session_progress",
    ...progress
  });
}

function getConnectionCount(sessionCode) {
  let count = 0;
  activeConnections.forEach((connSet, key) => {
    if (key.startsWith(`${sessionCode}:`)) {
      count += connSet.size;
    }
  });
  return count;
}

module.exports = {
  setupWebSocketServer,
  send,
  broadcast,
  broadcastToSession,
  broadcastResponse,
  notifySessionUpdate,
  notifyQuestionChange,
  notifyLeaderboard,
  notifySessionProgress,
  getLiveResults,
  getSessionProgress,
  getConnectionCount,
  activeConnections
};