const { Op } = require("sequelize");
const { activeConnections } = require("./websocket.service");
const { Session } = require("../models");

const WS_OPEN = 1;
const HISTORY_MAX_POINTS = 120;

const history = [];

function parseBucketKey(bucketKey) {
  const colonIndex = bucketKey.indexOf(":");
  if (colonIndex === -1) {
    return { sessionCode: bucketKey, role: "unknown" };
  }
  return {
    sessionCode: bucketKey.slice(0, colonIndex),
    role: bucketKey.slice(colonIndex + 1) || "unknown"
  };
}

function forEachOpenConnection(callback) {
  for (const [bucketKey, connSet] of activeConnections.entries()) {
    const { sessionCode, role } = parseBucketKey(bucketKey);
    for (const ws of connSet) {
      if (ws.readyState !== WS_OPEN) continue;
      callback({
        sessionCode,
        role,
        bucketKey,
        authStatus: ws.authStatus || "unknown"
      });
    }
  }
}

function buildSnapshot() {
  const byRole = {};
  const byAuthStatus = {};
  const sessionMap = new Map();
  const buckets = [];
  let totalConnections = 0;

  for (const [bucketKey, connSet] of activeConnections.entries()) {
    const { sessionCode, role } = parseBucketKey(bucketKey);
    let openCount = 0;

    for (const ws of connSet) {
      if (ws.readyState !== WS_OPEN) continue;
      openCount += 1;
      totalConnections += 1;

      byRole[role] = (byRole[role] || 0) + 1;
      const authStatus = ws.authStatus || "unknown";
      byAuthStatus[authStatus] = (byAuthStatus[authStatus] || 0) + 1;

      if (!sessionMap.has(sessionCode)) {
        sessionMap.set(sessionCode, {
          session_code: sessionCode,
          total_connections: 0,
          by_role: {}
        });
      }
      const sessionRow = sessionMap.get(sessionCode);
      sessionRow.total_connections += 1;
      sessionRow.by_role[role] = (sessionRow.by_role[role] || 0) + 1;
    }

    if (openCount > 0) {
      buckets.push({
        bucket_key: bucketKey,
        session_code: sessionCode,
        role,
        connections: openCount
      });
    }
  }

  const sessions = [...sessionMap.values()].sort(
    (a, b) => b.total_connections - a.total_connections
  );

  buckets.sort((a, b) => b.connections - a.connections);

  return {
    timestamp: new Date().toISOString(),
    total_connections: totalConnections,
    active_buckets: buckets.length,
    unique_sessions: sessions.length,
    by_role: byRole,
    by_auth_status: byAuthStatus,
    buckets,
    sessions
  };
}

function appendHistory(snapshot) {
  history.push({
    timestamp: snapshot.timestamp,
    total_connections: snapshot.total_connections,
    unique_sessions: snapshot.unique_sessions,
    active_buckets: snapshot.active_buckets,
    by_role: { ...snapshot.by_role }
  });

  if (history.length > HISTORY_MAX_POINTS) {
    history.splice(0, history.length - HISTORY_MAX_POINTS);
  }
}

async function enrichSessionsWithMetadata(sessions) {
  if (!sessions.length) return [];

  const codes = sessions.map((row) => row.session_code).filter(Boolean);
  const dbSessions = await Session.findAll({
    where: { session_code: { [Op.in]: codes } },
    attributes: ["session_id", "session_code", "title", "status", "dept_id"]
  });

  const byCode = new Map(dbSessions.map((row) => [row.session_code, row]));

  return sessions.map((row) => {
    const meta = byCode.get(row.session_code);
    return {
      ...row,
      session_id: meta?.session_id ?? null,
      title: meta?.title ?? null,
      status: meta?.status ?? null,
      dept_id: meta?.dept_id ?? null
    };
  });
}

async function getWebSocketMonitorData() {
  const snapshot = buildSnapshot();
  appendHistory(snapshot);

  const sessions = await enrichSessionsWithMetadata(snapshot.sessions);

  return {
    ...snapshot,
    sessions,
    history: [...history],
    server: {
      process_uptime_seconds: Math.floor(process.uptime()),
      memory_heap_used_mb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
      memory_rss_mb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1))
    }
  };
}

module.exports = {
  getWebSocketMonitorData,
  buildSnapshot,
  forEachOpenConnection
};
