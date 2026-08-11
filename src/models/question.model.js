const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Question = sequelize.define(
  "questions",
  {
    question_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    dept_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    question_type: {
      type: DataTypes.ENUM(
        "mcq",
        "poll",
        "survey",
        "word_cloud",
        "rating",
        "open_text",
        "true_false",
        "ranking",
        "fill_blank",
        "emoji_reaction"
      ),
      allowNull: false
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    media_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    media_type: {
      type: DataTypes.ENUM("image", "gif", "video_file", "video_embed", "audio_file"),
      allowNull: true
    },
    media_thumbnail_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_quiz_mode: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    points_value: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 10
    },
    time_limit_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    allow_multiple_select: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    rating_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    rating_max: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 10
    },
    rating_min_label: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    rating_max_label: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    survey_subtype: {
      type: DataTypes.ENUM(
        "mcq",
        "poll",
        "word_cloud",
        "rating",
        "open_text",
        "true_false",
        "ranking",
        "fill_blank",
        "emoji_reaction"
      ),
      allowNull: true
    },
    is_live: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    live_activated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    answer_revealed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    show_leaderboard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    open_for_reattempt: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    submissions_closed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    set_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: "questions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  }
);

module.exports = Question;
