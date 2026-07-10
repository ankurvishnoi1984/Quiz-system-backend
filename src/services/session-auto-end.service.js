const { Op } = require("sequelize");
const { Session } = require("../models");
const { buildAutoEndAt } = require("../utils/sessionDateTime");
const { endSessionBySystem } = require("./session.service");
const { buildSessionLeaderboard } = require("./response.service");
const { notifySessionUpdate } = require("./websocket.service");

const AUTO_END_POLL_MS = Number(process.env.SESSION_AUTO_END_POLL_MS) || 30000;

let pollTimer = null;

async function processDueAutoEndSessions() {
  const sessions = await Session.findAll({
    where: {
      auto_end_enabled: true,
      status: { [Op.in]: ["live", "paused"] },
      auto_end_date: { [Op.ne]: null },
      auto_end_time: { [Op.ne]: null }
    }
  });

  const now = Date.now();
  let endedCount = 0;

  for (const session of sessions) {
    const endAt = buildAutoEndAt(session);
    if (!endAt || Number.isNaN(endAt.getTime()) || endAt.getTime() > now) {
      continue;
    }

    const ended = await endSessionBySystem(session, endAt);
    if (!ended?.session_code) continue;

    endedCount += 1;

    try {
      const extra = {};
      if (ended.leaderboard_enabled) {
        extra.leaderboard = await buildSessionLeaderboard(ended.session_id);
      }
      notifySessionUpdate(ended.session_code, ended.status, extra);
    } catch (error) {
      console.warn("[auto-end] Failed to notify session end:", error.message);
    }
  }

  return endedCount;
}

function startSessionAutoEndScheduler() {
  if (pollTimer) return;

  pollTimer = setInterval(() => {
    processDueAutoEndSessions().catch((error) => {
      console.warn("[auto-end] Scheduler tick failed:", error.message);
    });
  }, AUTO_END_POLL_MS);

  if (typeof pollTimer.unref === "function") {
    pollTimer.unref();
  }

  processDueAutoEndSessions().catch((error) => {
    console.warn("[auto-end] Initial scheduler run failed:", error.message);
  });

  console.log(`[auto-end] Scheduler started (every ${AUTO_END_POLL_MS}ms)`);
}

module.exports = {
  processDueAutoEndSessions,
  startSessionAutoEndScheduler
};
