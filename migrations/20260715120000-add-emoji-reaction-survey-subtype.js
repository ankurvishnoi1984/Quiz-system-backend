"use strict";

const SURVEY_SUBTYPE_ENUM_WITH_EMOJI =
  "ENUM('mcq','poll','word_cloud','rating','open_text','true_false','ranking','fill_blank','emoji_reaction')";
const SURVEY_SUBTYPE_ENUM_PREV =
  "ENUM('mcq','poll','word_cloud','rating','open_text','true_false','ranking','fill_blank')";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY survey_subtype ${SURVEY_SUBTYPE_ENUM_WITH_EMOJI} NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE questions SET survey_subtype = 'mcq' WHERE survey_subtype = 'emoji_reaction'`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY survey_subtype ${SURVEY_SUBTYPE_ENUM_PREV} NULL`
    );
  }
};
