const { Department, Client } = require("../models");

async function createDepartment(input) {
  const client = await Client.findByPk(input.client_id);
  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }

  const existing = await Department.findOne({
    where: {
      client_id: input.client_id,
      slug: input.slug
    }
  });
  if (existing) {
    const error = new Error("Department slug already exists for this client");
    error.statusCode = 409;
    throw error;
  }

  return Department.create({
    client_id: input.client_id,
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    logo_url: input.logo_url || null,
    header_color: input.header_color || null,
    default_anonymous: input.default_anonymous ?? false,
    default_max_participants: input.default_max_participants || 500,
    profanity_filter_enabled: input.profanity_filter_enabled ?? true,
    is_active: input.is_active ?? true
  });
}

async function getDepartments(filters = {}) {
  const where = {};
  if (filters.client_id) {
    where.client_id = filters.client_id;
  }

  return Department.findAll({
    where,
    include: [{ model: Client, attributes: ["client_id", "name", "slug"] }],
    order: [["dept_id", "DESC"]]
  });
}

async function getDepartmentById(deptId) {
  const department = await Department.findByPk(deptId, {
    include: [{ model: Client, attributes: ["client_id", "name", "slug"] }]
  });

  if (!department) {
    const error = new Error("Department not found");
    error.statusCode = 404;
    throw error;
  }

  return department;
}

module.exports = {
  createDepartment,
  getDepartments,
  getDepartmentById
};
