"use strict";

const WITH_EMOJI =
  "ENUM('mcq','poll','survey','word_cloud','rating','open_text','true_false','ranking','fill_blank','emoji_reaction')";
const WITHOUT_EMOJI =
  "ENUM('mcq','poll','survey','word_cloud','rating','open_text','true_false','ranking','fill_blank')";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY question_type ${WITH_EMOJI} NOT NULL`
    );
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE question_templates MODIFY question_type ${WITH_EMOJI} NOT NULL`
      );
    } catch (error) {
      // Templates table may not exist in every environment.
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY question_type ${WITHOUT_EMOJI} NOT NULL`
    );
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE question_templates MODIFY question_type ${WITHOUT_EMOJI} NOT NULL`
      );
    } catch (error) {
      // ignore
    }
  }
};
