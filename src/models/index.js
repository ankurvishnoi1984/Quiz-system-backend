const User = require("./user.model");
const Plan = require("./plan.model");
const UserParticipantAddon = require("./user-participant-addon.model");
const Client = require("./client.model");
const Department = require("./department.model");
const Session = require("./session.model");
const SessionEmbedToken = require("./session-embed-token.model");
const Participant = require("./participant.model");
const Question = require("./question.model");
const QuestionSet = require("./question-set.model");
const QuestionOption = require("./question-option.model");
const Response = require("./response.model");
const QaQuestion = require("./qa-question.model");
const QaUpvote = require("./qa-upvote.model");
const MediaAsset = require("./media-asset.model");
const MailConfig = require("./mail-config.model");
const AuditLog = require("./audit-log.model");
const registerAuditHooks = require("./register-audit-hooks");

Plan.hasMany(User, { foreignKey: "plan_id", as: "users" });
User.belongsTo(Plan, { foreignKey: "plan_id", as: "plan" });
User.hasMany(UserParticipantAddon, { foreignKey: "user_id", as: "participant_addons" });
UserParticipantAddon.belongsTo(User, { foreignKey: "user_id", as: "user" });

Client.hasMany(Department, { foreignKey: "client_id" });
Department.belongsTo(Client, { foreignKey: "client_id" });
Department.hasMany(Session, { foreignKey: "dept_id" });
Session.belongsTo(Department, { foreignKey: "dept_id" });
User.hasMany(Session, { foreignKey: "host_id" });
Session.belongsTo(User, { foreignKey: "host_id" });
Session.hasMany(SessionEmbedToken, { foreignKey: "session_id" });
SessionEmbedToken.belongsTo(Session, { foreignKey: "session_id" });
Session.hasMany(Participant, { foreignKey: "session_id" });
Participant.belongsTo(Session, { foreignKey: "session_id" });
Department.hasMany(Participant, { foreignKey: "dept_id" });
Participant.belongsTo(Department, { foreignKey: "dept_id" });
Session.hasMany(Question, { foreignKey: "session_id" });
Question.belongsTo(Session, { foreignKey: "session_id" });
Session.hasMany(QuestionSet, { foreignKey: "session_id" });
QuestionSet.belongsTo(Session, { foreignKey: "session_id" });
QuestionSet.hasMany(Question, { foreignKey: "set_id", as: "questions" });
Question.belongsTo(QuestionSet, { foreignKey: "set_id", as: "set" });
QuestionSet.hasMany(Participant, { foreignKey: "assigned_set_id", as: "assignedParticipants" });
Participant.belongsTo(QuestionSet, { foreignKey: "assigned_set_id", as: "assignedSet" });
Department.hasMany(Question, { foreignKey: "dept_id" });
Question.belongsTo(Department, { foreignKey: "dept_id" });
Question.hasMany(QuestionOption, { foreignKey: "question_id" });
QuestionOption.belongsTo(Question, { foreignKey: "question_id" });
Session.hasMany(Response, { foreignKey: "session_id" });
Response.belongsTo(Session, { foreignKey: "session_id" });
Department.hasMany(Response, { foreignKey: "dept_id" });
Response.belongsTo(Department, { foreignKey: "dept_id" });
Question.hasMany(Response, { foreignKey: "question_id" });
Response.belongsTo(Question, { foreignKey: "question_id" });
Participant.hasMany(Response, { foreignKey: "participant_id" });
Response.belongsTo(Participant, { foreignKey: "participant_id" });
QuestionOption.hasMany(Response, { foreignKey: "option_id" });
Response.belongsTo(QuestionOption, { foreignKey: "option_id" });
Session.hasMany(QaQuestion, { foreignKey: "session_id" });
QaQuestion.belongsTo(Session, { foreignKey: "session_id" });
Department.hasMany(QaQuestion, { foreignKey: "dept_id" });
QaQuestion.belongsTo(Department, { foreignKey: "dept_id" });
Participant.hasMany(QaQuestion, { foreignKey: "participant_id" });
QaQuestion.belongsTo(Participant, { foreignKey: "participant_id" });
User.hasMany(QaQuestion, { foreignKey: "answered_by" });
QaQuestion.belongsTo(User, { foreignKey: "answered_by" });
QaQuestion.hasMany(QaUpvote, { foreignKey: "qa_id" });
QaUpvote.belongsTo(QaQuestion, { foreignKey: "qa_id" });
Participant.hasMany(QaUpvote, { foreignKey: "participant_id" });
QaUpvote.belongsTo(Participant, { foreignKey: "participant_id" });
Department.hasMany(MediaAsset, { foreignKey: "dept_id" });
MediaAsset.belongsTo(Department, { foreignKey: "dept_id" });
User.hasMany(MediaAsset, { foreignKey: "uploaded_by" });
MediaAsset.belongsTo(User, { foreignKey: "uploaded_by" });

const models = {
  User,
  Plan,
  UserParticipantAddon,
  Client,
  Department,
  Session,
  SessionEmbedToken,
  Participant,
  Question,
  QuestionSet,
  QuestionOption,
  Response,
  QaQuestion,
  QaUpvote,
  MediaAsset,
  MailConfig,
  AuditLog
};

registerAuditHooks(models);

module.exports = models;
