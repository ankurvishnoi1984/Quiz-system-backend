const User = require("./user.model");
const Client = require("./client.model");
const Department = require("./department.model");
const Session = require("./session.model");
const Participant = require("./participant.model");
const Question = require("./question.model");
const QuestionOption = require("./question-option.model");

Client.hasMany(Department, { foreignKey: "client_id" });
Department.belongsTo(Client, { foreignKey: "client_id" });
Department.hasMany(Session, { foreignKey: "dept_id" });
Session.belongsTo(Department, { foreignKey: "dept_id" });
User.hasMany(Session, { foreignKey: "host_id" });
Session.belongsTo(User, { foreignKey: "host_id" });
Session.hasMany(Participant, { foreignKey: "session_id" });
Participant.belongsTo(Session, { foreignKey: "session_id" });
Department.hasMany(Participant, { foreignKey: "dept_id" });
Participant.belongsTo(Department, { foreignKey: "dept_id" });
Session.hasMany(Question, { foreignKey: "session_id" });
Question.belongsTo(Session, { foreignKey: "session_id" });
Department.hasMany(Question, { foreignKey: "dept_id" });
Question.belongsTo(Department, { foreignKey: "dept_id" });
Question.hasMany(QuestionOption, { foreignKey: "question_id" });
QuestionOption.belongsTo(Question, { foreignKey: "question_id" });

module.exports = {
  User,
  Client,
  Department,
  Session,
  Participant,
  Question,
  QuestionOption
};
