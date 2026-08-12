const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Plan, User, Session, Participant } = require("../models");
const { sendParticipantLimitExceededEmail } = require("./email.service");

const ACCOUNT_PLAN_LIMIT_MESSAGE =
  "Participant limit exceeded for this session. Please contact the session host.";
const PLAN_LIMIT_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function toPlanPayload(plan) {
  if (!plan) return null;
  return {
    plan_id: plan.plan_id,
    name: plan.name,
    description: plan.description || null,
    max_participants: Number(plan.max_participants),
    is_active: Boolean(plan.is_active)
  };
}

async function listPlans() {
  const plans = await Plan.findAll({
    order: [
      ["max_participants", "ASC"],
      ["plan_id", "ASC"]
    ]
  });
  return plans.map(toPlanPayload);
}

async function getPlanOrThrow(planId) {
  const plan = await Plan.findByPk(planId);
  if (!plan) {
    const error = new Error("Plan not found");
    error.statusCode = 404;
    throw error;
  }
  return plan;
}

async function createPlan(input) {
  const name = String(input.name).trim();
  const existing = await Plan.findOne({ where: { name } });
  if (existing) {
    const error = new Error("A plan with this name already exists");
    error.statusCode = 409;
    throw error;
  }

  const plan = await Plan.create({
    name,
    description: input.description ? String(input.description).trim() : null,
    max_participants: Number(input.max_participants),
    is_active: input.is_active !== undefined ? Boolean(input.is_active) : true
  });

  return toPlanPayload(plan);
}

async function updatePlan({ planId, input }) {
  const plan = await getPlanOrThrow(planId);

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    const existing = await Plan.findOne({
      where: {
        name,
        plan_id: { [Op.ne]: plan.plan_id }
      }
    });
    if (existing) {
      const error = new Error("A plan with this name already exists");
      error.statusCode = 409;
      throw error;
    }
    plan.name = name;
  }

  if (input.description !== undefined) {
    plan.description = input.description ? String(input.description).trim() : null;
  }

  if (input.max_participants !== undefined) {
    plan.max_participants = Number(input.max_participants);
  }

  if (input.is_active !== undefined) {
    plan.is_active = Boolean(input.is_active);
  }

  await plan.save();
  return toPlanPayload(plan);
}

async function countParticipantsForHost(hostId) {
  if (!hostId) return 0;

  return Participant.count({
    include: [
      {
        model: Session,
        required: true,
        attributes: [],
        where: { host_id: hostId }
      }
    ]
  });
}

async function countParticipantsByHostIds(hostIds) {
  const ids = [...new Set((hostIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const usage = new Map(ids.map((id) => [id, 0]));
  if (!ids.length) return usage;

  const [rows] = await sequelize.query(
    `SELECT s.host_id AS host_id, COUNT(p.participant_id) AS used
     FROM participants p
     INNER JOIN sessions s ON s.session_id = p.session_id
     WHERE p.deleted_at IS NULL AND s.host_id IN (:ids)
     GROUP BY s.host_id`,
    { replacements: { ids } }
  );

  for (const row of rows) {
    usage.set(Number(row.host_id), Number(row.used) || 0);
  }

  return usage;
}

async function getHostPlanUsage(hostId) {
  const user = await User.findByPk(hostId, {
    attributes: [
      "user_id",
      "email",
      "full_name",
      "plan_id",
      "extra_participants",
      "plan_limit_email_sent_at",
      "is_active"
    ],
    include: [{ model: Plan, as: "plan", required: false }]
  });

  if (!user) {
    return {
      host: null,
      plan: null,
      used: 0,
      plan_limit: null,
      extra_participants: 0,
      limit: null,
      remaining: null,
      exceeded: false,
      unrestricted: true,
      sessions_count: 0,
      percent_used: 0
    };
  }

  const plan = user.plan ? toPlanPayload(user.plan) : null;
  const used = await countParticipantsForHost(hostId);
  const sessionsCount = await Session.count({ where: { host_id: hostId } });
  const extraParticipants = Math.max(0, Number(user.extra_participants || 0));
  const unrestricted = plan?.max_participants == null;
  const planLimit = unrestricted ? null : Number(plan.max_participants);
  const limit = unrestricted ? null : planLimit + extraParticipants;
  const remaining = limit == null ? null : Math.max(0, limit - used);
  const exceeded = limit != null && used >= limit;
  const percentUsed = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return {
    host: user,
    plan,
    used,
    plan_limit: planLimit,
    extra_participants: extraParticipants,
    limit,
    remaining,
    exceeded,
    unrestricted,
    sessions_count: sessionsCount,
    percent_used: percentUsed
  };
}

async function getPlanJoinBlock(session) {
  if (!session?.host_id) {
    return { blocked: false, message: null, reason: null };
  }

  const usage = await getHostPlanUsage(session.host_id);
  if (!usage.exceeded) {
    return { blocked: false, message: null, reason: null, usage };
  }

  return {
    blocked: true,
    message: ACCOUNT_PLAN_LIMIT_MESSAGE,
    reason: "plan_limit",
    usage
  };
}

async function notifyHostPlanLimitIfNeeded(usage) {
  const host = usage?.host;
  const limit = usage?.limit;
  if (!host?.email || limit == null) return;

  const cutoff = new Date(Date.now() - PLAN_LIMIT_EMAIL_COOLDOWN_MS);
  const [updated] = await User.update(
    { plan_limit_email_sent_at: new Date() },
    {
      where: {
        user_id: host.user_id,
        [Op.or]: [
          { plan_limit_email_sent_at: null },
          { plan_limit_email_sent_at: { [Op.lt]: cutoff } }
        ]
      }
    }
  );

  if (!updated) return;

  try {
    await sendParticipantLimitExceededEmail({
      to: host.email,
      fullName: host.full_name,
      planName: usage.plan?.name || "your plan",
      used: usage.used,
      limit
    });
  } catch (err) {
    console.error("notifyHostPlanLimitIfNeeded email failed:", err);
  }
}

async function getCurrentUserPlanUsage(userId) {
  const usage = await getHostPlanUsage(userId);
  return {
    plan: usage.plan,
    used: usage.used,
    plan_limit: usage.plan_limit,
    extra_participants: Number(usage.extra_participants || 0),
    limit: usage.limit,
    remaining: usage.remaining,
    exceeded: usage.exceeded,
    unrestricted: Boolean(usage.unrestricted),
    sessions_count: Number(usage.sessions_count || 0),
    percent_used: Number(usage.percent_used || 0)
  };
}

module.exports = {
  ACCOUNT_PLAN_LIMIT_MESSAGE,
  toPlanPayload,
  listPlans,
  getPlanOrThrow,
  createPlan,
  updatePlan,
  countParticipantsForHost,
  countParticipantsByHostIds,
  getHostPlanUsage,
  getPlanJoinBlock,
  notifyHostPlanLimitIfNeeded,
  getCurrentUserPlanUsage
};
