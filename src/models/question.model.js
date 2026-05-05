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
        "word_cloud",
        "rating",
        "open_text",
        "true_false",
        "ranking",
        "fill_blank"
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
      type: DataTypes.ENUM("image", "gif", "video_file", "video_embed"),
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
      defaultValue: 5
    },
    rating_min_label: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    rating_max_label: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    is_live: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false
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
