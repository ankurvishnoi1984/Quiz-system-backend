const { WebSocketServer } = require("ws");
const { verifyAccessToken } = require("../utils/jwt");
const { isIntegrationsEnabled } = require("../config/integrations");
const { resolveEmbedToken } = require("./session-embed-token.service");

const activeConnections = new Map();

const WS_LOG = process.env.WS_DEBUG === "true" || process.env.NODE_ENV !== "production";

function wsLog(level, message, meta = {}) {
  if (!WS_LOG && level === "debug") return;
  const line = meta && Object.keys(meta).length ? `${message} ${JSON.stringify(meta)}` : message;
  if (level === "error") {
    console.error("[WS]", line);
  } else if (level === "warn") {
    console.warn("[WS]", line);
  } else {
    console.log("[WS]", line);
  }
}

function maskToken(token) {
  if (!token) return null;
  const s = String(token);
  return `${s.slice(0, 12)}…(${s.length} chars)`;
}

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const remote = req.socket?.remoteAddress || "unknown";
    let sessionCode = null;
    let role = null;

    try {
      const host = req.headers.host || "localhost";
      const url = new URL(req.url, `http://${host}`);
      const token = url.searchParams.get("token");
      sessionCode = url.searchParams.get("session");
      role = url.searchParams.get("role") || "participant";

      wsLog("info", "handshake_start", {
        remote,
        session: sessionCode,
        role,
        token: maskToken(token),
        upgrade: req.headers.upgrade,
        connection: req.headers.connection
      });

      if (!sessionCode) {
        wsLog("warn", "handshake_rejected", { remote, reason: "missing_session_code", code: 4000 });
        ws.close(4000, "Session code required");
        return;
      }

      let decoded = null;
      let authStatus = "anonymous";

      if (token) {
        try {
          decoded = verifyAccessToken(token);
          if (decoded.role === "participant") {
            authStatus = "participant_ok";
            wsLog("info", "auth_ok", {
              session: sessionCode,
              role,
              participant_id: decoded.participant_id,
              session_id: decoded.session_id,
              exp: decoded.exp
            });
          } else if (
            decoded.role === "host" ||
            decoded.role === "super_admin" ||
            decoded.role === "client_admin" ||
            decoded.role === "dept_admin"
          ) {
            authStatus = "staff_ok";
            wsLog("info", "auth_ok", {
              session: sessionCode,
              role: decoded.role,
              user_id: decoded.user_id,
              exp: decoded.exp
            });
          } else if (decoded.role === "presenter_viewer") {
            authStatus = "presenter_viewer_ok";
            wsLog("info", "auth_ok", {
              session: sessionCode,
              role: decoded.role,
              session_id: decoded.session_id,
              exp: decoded.exp
            });
          } else {
            authStatus = "token_unknown_role";
            wsLog("warn", "auth_token_unknown_role", {
              session: sessionCode,
              role: decoded.role
            });
          }
        } catch (err) {
          authStatus =
            err.name === "TokenExpiredError"
              ? "token_expired"
              : err.name === "JsonWebTokenError"
                ? "token_invalid"
                : "token_error";
          wsLog("warn", "auth_token_rejected", {
            session: sessionCode,
            role,
            token: maskToken(token),
            error_name: err.name,
            error_message: err.message
          });
          // Existing flow: continue without decoded user (do not hard-close)
        }
      } else {
        wsLog("info", "auth_no_token", { session: sessionCode, role });
      }

      const connectionKey = `${sessionCode}:${role}`;
      if (!activeConnections.has(connectionKey)) {
        activeConnections.set(connectionKey, new Set());
      }
      activeConnections.get(connectionKey).add(ws);

      ws.sessionCode = sessionCode;
      ws.role = role;
      ws.user = decoded;
      ws.authStatus = authStatus;

      // Embed tokens are opaque and only apply when integrations are enabled.
      if (isIntegrationsEnabled() && !decoded && token && role === "viewer") {
        resolveEmbedToken(token)
          .then((viewer) => {
            if (!viewer || ws.readyState !== ws.OPEN) return;
            ws.user = viewer;
            ws.authStatus = "embed_token_ok";
            wsLog("info", "auth_ok", {
              session: sessionCode,
              role: viewer.role,
              session_id: viewer.session_id,
              via: "embed_token"
            });
          })
          .catch(() => {});
      }

      ws.on("close", (code, reason) => {
        wsLog("info", "connection_closed", {
          session: sessionCode,
          role,
          authStatus,
          code,
          reason: reason?.toString() || "(none)"
        });
        const connSet = activeConnections.get(connectionKey);
        if (connSet) {
          connSet.delete(ws);
          if (connSet.size === 0) {
            activeConnections.delete(connectionKey);
          }
        }
      });

      ws.on("error", (error) => {
        wsLog("error", "socket_error", {
          session: sessionCode,
          role,
          message: error.message
        });
      });

      send(ws, {
        type: "connected",
        session: sessionCode,
        role: ws.role,
        auth_status: authStatus
      });

      wsLog("info", "handshake_complete", {
        session: sessionCode,
        role,
        authStatus,
        activeInBucket: activeConnections.get(connectionKey)?.size
      });
    } catch (error) {
      wsLog("error", "handshake_exception", {
        remote,
        session: sessionCode,
        role,
        message: error.message,
        stack: error.stack
      });
      try {
        ws.close(1011, "Handshake failed");
      } catch {
        // ignore
      }
    }
  });

  wsLog("info", "server_listening", { path: "/ws" });
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

  // Lobby / join-wave: no answers yet — skip loading every response row
  const responseCount = await ResponseModel.count({ where: { session_id: sessionId } });
  if (responseCount === 0) {
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

function notifySessionUpdate(sessionCode, status, extra = {}) {
  broadcastToSession(sessionCode, {
    type: "session_updated",
    status,
    ...extra
  });
}

function notifyQuestionChange(sessionCode, payload) {
  if (!sessionCode || !payload) return;
  broadcastToSession(sessionCode, {
    type: "question_changed",
    question_id: payload.question_id,
    is_live: Boolean(payload.is_live),
    live_activated_at: payload.live_activated_at ?? null,
    time_limit_seconds: payload.time_limit_seconds ?? null,
    submissions_closed: Boolean(payload.submissions_closed),
    open_for_reattempt: Boolean(payload.open_for_reattempt)
  });
}

function notifyAllQuestionsSubmissionsClosed(sessionCode, payload = {}) {
  if (!sessionCode) return;
  broadcastToSession(sessionCode, {
    type: "all_questions_submissions_closed",
    closed_count: Number(payload.closed_count) || 0
  });
}

function notifyQuestionSubmissionsClosed(sessionCode, question) {
  if (!sessionCode || !question) return;
  broadcastToSession(sessionCode, {
    type: "question_submissions_closed",
    question_id: Number(question.question_id),
    submissions_closed: true,
    question_text: question.question_text || ""
  });
}

function notifyQuestionReattemptOpened(sessionCode, questionId, questionText, extra = {}) {
  broadcastToSession(sessionCode, {
    type: "question_reattempt_opened",
    question_id: Number(questionId),
    question_text: questionText || "",
    live_activated_at: extra.live_activated_at ?? null,
    time_limit_seconds: extra.time_limit_seconds ?? null
  });
}

function notifyAnswerRevealed(sessionCode, questionId, answerRevealed, correctOptionIds = []) {
  broadcastToSession(sessionCode, {
    type: "answer_revealed",
    question_id: Number(questionId),
    answer_revealed: Boolean(answerRevealed),
    correct_option_ids: (correctOptionIds || []).map(Number)
  });
}

function notifyQuestionLeaderboardVisibility(sessionCode, questionId, visible) {
  broadcastToSession(sessionCode, {
    type: "question_leaderboard_visibility",
    question_id: Number(questionId),
    show_leaderboard: Boolean(visible)
  });
}

function notifyLeaderboard(sessionCode, payload) {
  const data =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? payload
      : { leaderboard: payload };
  broadcastToSession(sessionCode, {
    type: "leaderboard_update",
    leaderboard: data.leaderboard || [],
    question_id: data.question_id ?? null,
    question_leaderboard: data.question_leaderboard || null
  });
}

function notifyRankingResponseSubmitted(sessionCode, payload) {
  if (!sessionCode || !payload) return;
  broadcastToSession(sessionCode, {
    type: "ranking-response-submitted",
    questionId: Number(payload.questionId),
    totalResponses: Number(payload.totalResponses || 0),
    rankings: payload.rankings || [],
    analytics: payload.analytics || null
  });
}

function notifySessionSettings(sessionCode, settings) {
  broadcastToSession(sessionCode, {
    type: "session_settings_updated",
    leaderboard_enabled: Boolean(
      settings.leaderboard_enabled === true ||
        settings.leaderboard_enabled === 1 ||
        settings.leaderboard_enabled === "1"
    ),
    survey_results_enabled: Boolean(
      settings.survey_results_enabled === true ||
        settings.survey_results_enabled === 1 ||
        settings.survey_results_enabled === "1" ||
        (typeof Buffer !== "undefined" &&
          Buffer.isBuffer(settings.survey_results_enabled) &&
          settings.survey_results_enabled[0])
    ),
    show_question_leaderboard: Boolean(settings.show_question_leaderboard),
    participant_navigation_enabled: settings.participant_navigation_enabled !== false,
    allow_late_join: Boolean(settings.allow_late_join)
  });
}

function notifyParticipantJoined(sessionCode, participant) {
  if (!sessionCode || !participant) return;
  broadcastToSession(sessionCode, {
    type: "participant_joined",
    participant: {
      participant_id: participant.participant_id,
      nickname: participant.nickname || null
    }
  });
}

/** Coalesce join/submit progress fan-out: at most ~1 broadcast per session / debounce window. */
const SESSION_PROGRESS_DEBOUNCE_MS = Number(process.env.SESSION_PROGRESS_DEBOUNCE_MS || 2000);
const sessionProgressNotifyState = new Map();

function notifySessionProgress(sessionCode, sessionId) {
  if (!sessionCode || sessionId == null) return Promise.resolve();

  const key = `${sessionCode}:${Number(sessionId)}`;
  let state = sessionProgressNotifyState.get(key);
  if (!state) {
    state = { timer: null, pending: false, lastSentAt: 0, inFlight: false };
    sessionProgressNotifyState.set(key, state);
  }
  state.pending = true;

  const flush = async () => {
    if (!state.pending || state.inFlight) return;
    state.pending = false;
    state.inFlight = true;
    try {
      const progress = await getSessionProgress(sessionId);
      state.lastSentAt = Date.now();
      broadcastToSession(sessionCode, {
        type: "session_progress",
        ...progress
      });
    } catch (err) {
      wsLog("warn", "session_progress_failed", {
        session: sessionCode,
        session_id: sessionId,
        error: err.message
      });
    } finally {
      state.inFlight = false;
      if (state.pending) schedule();
    }
  };

  const schedule = () => {
    if (state.timer || state.inFlight) return;
    const wait = Math.max(0, SESSION_PROGRESS_DEBOUNCE_MS - (Date.now() - state.lastSentAt));
    state.timer = setTimeout(() => {
      state.timer = null;
      flush().catch(() => {});
    }, wait);
  };

  schedule();
  return Promise.resolve();
}

function notifyPresentSlideChanged(sessionCode, payload) {
  if (!sessionCode) return;
  broadcastToSession(sessionCode, {
    type: "present_slide_changed",
    session_id: payload?.session_id ?? null,
    slide_index: payload?.slide_index ?? 0
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
  notifyQuestionSubmissionsClosed,
  notifyAllQuestionsSubmissionsClosed,
  notifyQuestionReattemptOpened,
  notifyAnswerRevealed,
  notifyQuestionLeaderboardVisibility,
  notifyLeaderboard,
  notifyRankingResponseSubmitted,
  notifySessionSettings,
  notifyParticipantJoined,
  notifySessionProgress,
  notifyPresentSlideChanged,
  getLiveResults,
  getSessionProgress,
  getConnectionCount,
  activeConnections
};
