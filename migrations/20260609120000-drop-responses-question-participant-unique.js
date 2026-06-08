"use strict";

/**
 * Multi-select responses store one row per selected option.
 * uq_question_participant (question_id, participant_id) blocks that; keep
 * uq_response_unique (question_id, participant_id, option_id) instead.
 */
module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex("responses");
    const hasLegacyUnique = indexes.some((index) => index.name === "uq_question_participant");
    if (hasLegacyUnique) {
      await queryInterface.removeIndex("responses", "uq_question_participant");
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex("responses");
    const hasLegacyUnique = indexes.some((index) => index.name === "uq_question_participant");
    if (!hasLegacyUnique) {
      await queryInterface.addIndex("responses", ["question_id", "participant_id"], {
        unique: true,
        name: "uq_question_participant"
      });
    }
  }
};
