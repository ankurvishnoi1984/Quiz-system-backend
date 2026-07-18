const { Op } = require("sequelize");
const AuditLog = require("../models/audit-log.model");
const { requestMetadataFromContext } = require("../utils/audit-context");

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /password|password_hash|passcode|token|authorization|cookie|secret|smtp_pass|api[_-]?key/i;

function sanitizeAuditValue(value, seen = new WeakSet()) {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > 10000 ? `${value.slice(0, 10000)}…` : value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[Buffer ${value.length} bytes]`;
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value.slice(0, 500).map((item) => sanitizeAuditValue(item, seen));
    if (value.length > 500) sanitized.push(`[${value.length - 500} more items]`);
    return sanitized;
  }

  return Object.entries(value).reduce((result, [key, item]) => {
    result[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : sanitizeAuditValue(item, seen);
    return result;
  }, {});
}

async function logAuditEvent(event, options = {}) {
  const requestMetadata = requestMetadataFromContext();
  const payload = {
    ...requestMetadata,
    ...event,
    entity_id: event.entity_id == null ? null : String(event.entity_id),
    before_values: sanitizeAuditValue(event.before_values ?? null),
    after_values: sanitizeAuditValue(event.after_values ?? null),
    metadata: sanitizeAuditValue(event.metadata ?? null)
  };

  try {
    return await AuditLog.create(payload, {
      transaction: options.transaction || null,
      hooks: false
    });
  } catch (error) {
    console.error("Failed to write audit log", {
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      error: error.message
    });
    return null;
  }
}

function normalizePositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

async function listAuditLogs(filters = {}) {
  const page = normalizePositiveInteger(filters.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = normalizePositiveInteger(filters.limit, 50, 200);
  const where = {};

  if (filters.action) where.action = filters.action;
  if (filters.entity_type) where.entity_type = filters.entity_type;
  if (filters.actor_type) where.actor_type = filters.actor_type;
  if (filters.actor_id) where.actor_id = String(filters.actor_id);
  if (filters.request_id) where.request_id = filters.request_id;
  if (filters.from || filters.to) {
    where.created_at = {};
    if (filters.from) where.created_at[Op.gte] = new Date(filters.from);
    if (filters.to) where.created_at[Op.lte] = new Date(filters.to);
  }

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    order: [["created_at", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });

  return {
    logs: rows,
    pagination: {
      page,
      limit,
      total: count,
      total_pages: Math.ceil(count / limit)
    }
  };
}

module.exports = {
  sanitizeAuditValue,
  logAuditEvent,
  listAuditLogs
};
