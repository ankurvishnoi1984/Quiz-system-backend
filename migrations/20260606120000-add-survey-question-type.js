"use strict";

const WITH_SURVEY =
  "ENUM('mcq','poll','survey','word_cloud','rating','open_text','true_false','ranking','fill_blank')";
const WITHOUT_SURVEY =
  "ENUM('mcq','poll','word_cloud','rating','open_text','true_false','ranking','fill_blank')";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY question_type ${WITH_SURVEY} NOT NULL`
    );
    await queryInterface.addColumn("questions", "survey_subtype", {
      type: Sequelize.ENUM(
        "mcq",
        "poll",
        "word_cloud",
        "rating",
        "open_text",
        "true_false",
        "ranking",
        "fill_blank"
      ),
      allowNull: true
    });
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE question_templates MODIFY question_type ${WITH_SURVEY} NOT NULL`
      );
    } catch (error) {
      // Templates table may not exist in every environment.
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("questions", "survey_subtype");
    await queryInterface.sequelize.query(
      `ALTER TABLE questions MODIFY question_type ${WITHOUT_SURVEY} NOT NULL`
    );
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE question_templates MODIFY question_type ${WITHOUT_SURVEY} NOT NULL`
      );
    } catch (error) {
      // ignore
    }
  }
};
