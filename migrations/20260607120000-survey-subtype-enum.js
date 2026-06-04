"use strict";

const SURVEY_SUBTYPE_ENUM =
  "ENUM('mcq','poll','word_cloud','rating','open_text','true_false','ranking','fill_blank')";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY survey_subtype ${SURVEY_SUBTYPE_ENUM} NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE questions MODIFY survey_subtype VARCHAR(32) NULL"
    );
  }
};
