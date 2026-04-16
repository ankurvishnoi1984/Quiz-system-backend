const { Client } = require("../models");

async function createClient(input) {
  const existing = await Client.findOne({ where: { slug: input.slug } });
  if (existing) {
    const error = new Error("Client slug already exists");
    error.statusCode = 409;
    throw error;
  }

  const client = await Client.create({
    name: input.name,
    slug: input.slug,
    contact_email: input.contact_email,
    logo_url: input.logo_url || null,
    primary_color: input.primary_color || "#1E3A5F",
    secondary_color: input.secondary_color || "#2E86AB",
    custom_domain: input.custom_domain || null,
    contact_phone: input.contact_phone || null,
    subscription_tier: input.subscription_tier || "standard",
    max_participants_per_session: input.max_participants_per_session || 500,
    features_enabled: input.features_enabled || {},
    is_active: input.is_active ?? true
  });

  return client;
}

async function getClients() {
  return Client.findAll({
    order: [["client_id", "DESC"]]
  });
}

async function getClientById(clientId) {
  const client = await Client.findByPk(clientId);
  if (!client) {
    const error = new Error("Client not found");
    error.statusCode = 404;
    throw error;
  }
  return client;
}

module.exports = {
  createClient,
  getClients,
  getClientById
};
