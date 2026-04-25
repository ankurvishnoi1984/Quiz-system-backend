const { successResponse, errorResponse } = require("../utils/response");
const {
  listDepartmentSessions,
  createSession,
  getSessionById,
  updateSession,
  archiveSession,
  transitionSessionStatus,
  getSessionByCode,
  joinSession,
  getSessionQr
} = require("../services/session.service");
const {
  validateCreateSessionPayload,
  validateUpdateSessionPayload,
  validateJoinSessionPayload
} = require("../validators/session.validator");
const { notifySessionUpdate } = require("../services/websocket.service");

async function listByDepartment(req, res) {
  try {
    const sessions = await listDepartmentSessions({
      deptId: Number(req.params.deptId),
      status: req.query.status,
      user: req.user
    });
    return successResponse(res, { sessions }, "Sessions fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function createForDepartment(req, res) {
  try {
    const errors = validateCreateSessionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const session = await createSession({
      deptId: Number(req.params.deptId),
      input: req.body,
      user: req.user
    });
    return successResponse(res, { session }, "Session created successfully", 201);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function detail(req, res) {
  try {
    const session = await getSessionById({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { session }, "Session fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function update(req, res) {
  try {
    const errors = validateUpdateSessionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const session = await updateSession({
      sessionId: Number(req.params.sessionId),
      input: req.body,
      user: req.user
    });
    return successResponse(res, { session }, "Session updated", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function remove(req, res) {
  try {
    const session = await archiveSession({
      sessionId: Number(req.params.sessionId),
      user: req.user
    });
    return successResponse(res, { session }, "Session archived", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

function lifecycleAction(action) {
  const actionMessage = {
    start: "started",
    pause: "paused",
    resume: "resumed",
    end: "ended"
  };

  return async (req, res) => {
    try {
      const session = await transitionSessionStatus({
        sessionId: Number(req.params.sessionId),
        user: req.user,
        action
      });
      if (session?.session_code) {
        notifySessionUpdate(session.session_code, session.status);
      }
      return successResponse(
        res,
        { session },
        `Session ${actionMessage[action]} successfully`,
        200
      );
    } catch (err) {
      return errorResponse(res, err.message, err.statusCode || 500);
    }
  };
}

async function lookupByCode(req, res) {
  try {
    const session = await getSessionByCode(req.params.code);
    return successResponse(
      res,
      {
        session: {
          session_id: session.session_id,
          dept_id: session.dept_id,
          title: session.title,
          status: session.status,
          session_code: session.session_code,
          department: session.department
        }
      },
      "Session found",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function joinByCode(req, res) {
  try {
    const errors = validateJoinSessionPayload(req.body);
    if (errors.length > 0) {
      return errorResponse(res, "Validation failed", 400, errors);
    }

    const result = await joinSession({
      code: req.params.code,
      payload: req.body || {}
    });
    return successResponse(
      res,
      {
        participant: result.participant,
        participant_token: result.token
      },
      "Joined session successfully",
      200
    );
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

async function qr(req, res) {
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const data = await getSessionQr({
      sessionId: Number(req.params.sessionId),
      user: req.user,
      baseUrl
    });
    return successResponse(res, data, "Session QR data fetched", 200);
  } catch (err) {
    return errorResponse(res, err.message, err.statusCode || 500);
  }
}

module.exports = {
  listByDepartment,
  createForDepartment,
  detail,
  update,
  remove,
  start: lifecycleAction("start"),
  pause: lifecycleAction("pause"),
  resume: lifecycleAction("resume"),
  end: lifecycleAction("end"),
  lookupByCode,
  joinByCode,
  qr
};
