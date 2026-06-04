"use strict";

const WITH_POLL =
  "ENUM('mcq','poll','word_cloud','rating','open_text','true_false','ranking','fill_blank')";
const WITHOUT_POLL =
  "ENUM('mcq','word_cloud','rating','open_text','true_false','ranking','fill_blank')";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY question_type ${WITH_POLL} NOT NULL`
    );
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE question_templates MODIFY question_type ${WITH_POLL} NOT NULL`
      );
    } catch (error) {
      // Templates table may not exist in every environment.
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY question_type ${WITHOUT_POLL} NOT NULL`
    );
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE question_templates MODIFY question_type ${WITHOUT_POLL} NOT NULL`
      );
    } catch (error) {
      // ignore
    }
  }
};
