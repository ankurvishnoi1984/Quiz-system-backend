const { logAuditEvent } = require("../services/audit-log.service");

const AUDIT_BEFORE_UPDATE = Symbol("auditBeforeUpdate");
const AUDIT_BEFORE_DELETE = Symbol("auditBeforeDelete");

/** Secrets must never be written into audit_logs, even though the row itself is auditable. */
const REDACTED_FIELDS = new Set(["token", "password_hash", "refresh_token", "smtp_password"]);
const REDACTED_PLACEHOLDER = "[redacted]";

function redact(values) {
  if (!values || typeof values !== "object") return values;
  return Object.keys(values).reduce((result, key) => {
    result[key] = REDACTED_FIELDS.has(key) && values[key] != null ? REDACTED_PLACEHOLDER : values[key];
    return result;
  }, {});
}

function plainValues(instance) {
  if (!instance) return null;
  return redact(typeof instance.toJSON === "function" ? instance.toJSON() : { ...instance });
}

function entityType(model) {
  const tableName = model.getTableName();
  return typeof tableName === "string" ? tableName : tableName.tableName;
}

function entityId(instance) {
  const primaryKey = instance?.constructor?.primaryKeyAttribute;
  return primaryKey ? instance.get(primaryKey) : null;
}

function scopeFromValues(values = {}) {
  const scope = {};
  if (values.client_id != null) scope.client_id = values.client_id;
  if (values.dept_id != null) scope.dept_id = values.dept_id;
  if (values.session_id != null) scope.session_id = values.session_id;
  return scope;
}

function changedValues(instance, source) {
  const changed = instance.changed();
  const fields = Array.isArray(changed) ? changed : [];
  return redact(
    fields.reduce((result, field) => {
      result[field] = source[field];
      return result;
    }, {})
  );
}

function registerModelAuditHooks(model) {
  const type = entityType(model);

  model.addHook("afterCreate", "auditAfterCreate", async (instance, options) => {
    const values = plainValues(instance);
    await logAuditEvent(
      {
        action: "create",
        entity_type: type,
        entity_id: entityId(instance),
        ...scopeFromValues(values),
        after_values: values
      },
      options
    );
  });

  model.addHook("beforeUpdate", "auditBeforeUpdate", (instance) => {
    instance[AUDIT_BEFORE_UPDATE] = changedValues(instance, instance._previousDataValues || {});
  });

  model.addHook("afterUpdate", "auditAfterUpdate", async (instance, options) => {
    const values = plainValues(instance);
    await logAuditEvent(
      {
        action: "update",
        entity_type: type,
        entity_id: entityId(instance),
        ...scopeFromValues(values),
        before_values: instance[AUDIT_BEFORE_UPDATE] || null,
        after_values: changedValues(instance, values)
      },
      options
    );
    delete instance[AUDIT_BEFORE_UPDATE];
  });

  model.addHook("beforeDestroy", "auditBeforeDestroy", (instance) => {
    instance[AUDIT_BEFORE_DELETE] = plainValues(instance);
  });

  model.addHook("afterDestroy", "auditAfterDestroy", async (instance, options) => {
    const values = instance[AUDIT_BEFORE_DELETE] || plainValues(instance);
    await logAuditEvent(
      {
        action: "delete",
        entity_type: type,
        entity_id: entityId(instance),
        ...scopeFromValues(values),
        before_values: values
      },
      options
    );
    delete instance[AUDIT_BEFORE_DELETE];
  });

  model.addHook("afterBulkCreate", "auditAfterBulkCreate", async (instances, options) => {
    if (options.individualHooks) return;
    const values = instances.map(plainValues);
    const primaryKey = model.primaryKeyAttribute;
    await logAuditEvent(
      {
        action: "create",
        entity_type: type,
        entity_id: null,
        after_values: values,
        metadata: {
          bulk: true,
          count: instances.length,
          entity_ids: instances
            .map((instance) => instance.get(primaryKey))
            .filter((id) => id != null)
        }
      },
      options
    );
  });

  model.addHook("afterBulkUpdate", "auditAfterBulkUpdate", async (options) => {
    if (options.individualHooks) return;
    await logAuditEvent(
      {
        action: "update",
        entity_type: type,
        entity_id: null,
        after_values: redact(options.attributes) || null,
        metadata: { bulk: true, where: options.where || null }
      },
      options
    );
  });

  model.addHook("afterBulkDestroy", "auditAfterBulkDestroy", async (options) => {
    if (options.individualHooks) return;
    await logAuditEvent(
      {
        action: "delete",
        entity_type: type,
        entity_id: null,
        metadata: { bulk: true, where: options.where || null }
      },
      options
    );
  });
}

function registerAuditHooks(models) {
  Object.values(models).forEach((model) => {
    if (!model || typeof model.addHook !== "function" || model.tableName === "audit_logs") return;
    registerModelAuditHooks(model);
  });
}

module.exports = registerAuditHooks;
