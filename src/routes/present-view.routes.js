const express = require("express");
const presentViewController = require("../controllers/present-view.controller");
const presenterViewerAuthMiddleware = require("../middlewares/presenter-viewer-auth.middleware");

const router = express.Router();

router.use("/present-view", presenterViewerAuthMiddleware);

router.get("/present-view/sessions/:sessionId", presentViewController.sessionDetail);
router.get("/present-view/sessions/:sessionId/questions", presentViewController.listQuestions);
router.get("/present-view/sessions/:sessionId/responses", presentViewController.listResponses);
router.get("/present-view/sessions/:sessionId/leaderboard", presentViewController.sessionLeaderboard);
router.get("/present-view/sessions/:sessionId/survey-summary", presentViewController.sessionSurveySummary);
router.get("/present-view/sessions/:sessionId/participants", presentViewController.listParticipants);
router.get("/present-view/sessions/:sessionId/qa", presentViewController.listQaQuestions);
router.get("/present-view/sessions/:sessionId/present-slide", presentViewController.presentSlide);
router.get("/present-view/responses/question/:questionId", presentViewController.questionResults);

module.exports = router;
