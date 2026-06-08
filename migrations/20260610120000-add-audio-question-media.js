"use strict";

/** Allow audio_file on question and media asset media_type enums. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("questions", "media_type", {
      type: Sequelize.ENUM("image", "gif", "video_file", "video_embed", "audio_file"),
      allowNull: true
    });
    await queryInterface.changeColumn("media_assets", "media_type", {
      type: Sequelize.ENUM("image", "gif", "video_file", "audio_file"),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("questions", "media_type", {
      type: Sequelize.ENUM("image", "gif", "video_file", "video_embed"),
      allowNull: true
    });
    await queryInterface.changeColumn("media_assets", "media_type", {
      type: Sequelize.ENUM("image", "gif", "video_file"),
      allowNull: false
    });
  }
};
