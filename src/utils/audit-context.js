const { AsyncLocalStorage } = require("async_hooks");
const { randomUUID } = require("crypto");

const auditContext = new AsyncLocalStorage();

function requestContextMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  auditContext.run({ req, requestId }, next);
}

function getRequestContext() {
  return auditContext.getStore() || null;
}

function actorFromRequest(req) {
  if (req?.user) {
    return {
      actor_type: "user",
      actor_id: String(req.user.user_id),
      actor_role: req.user.role || null,
      client_id: req.user.client_id || null,
      dept_id: req.user.dept_id || null,
      session_id: null
    };
  }
  if (req?.participant) {
    return {
      actor_type: "participant",
      actor_id: String(req.participant.participant_id),
      actor_role: "participant",
      client_id: null,
      dept_id: req.participant.dept_id || null,
      session_id: req.participant.session_id || null
    };
  }
  if (req?.presenterViewer) {
    return {
      actor_type: "presenter_viewer",
      actor_id: null,
      actor_role: "presenter_viewer",
      client_id: null,
      dept_id: null,
      session_id: req.presenterViewer.session_id || null
    };
  }
  return {
    actor_type: req ? "anonymous" : "system",
    actor_id: null,
    actor_role: null,
    client_id: null,
    dept_id: null,
    session_id: null
  };
}

function requestMetadataFromContext() {
  const store = getRequestContext();
  const req = store?.req;
  const actor = actorFromRequest(req);
  return {
    ...actor,
    request_id: store?.requestId || null,
    http_method: req?.method || null,
    request_path: req?.originalUrl || req?.url || null,
    ip_address: req?.ip || req?.socket?.remoteAddress || null,
    user_agent: req?.get?.("user-agent") || null
  };
}

module.exports = {
  requestContextMiddleware,
  getRequestContext,
  actorFromRequest,
  requestMetadataFromContext
};
