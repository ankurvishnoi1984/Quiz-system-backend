const express = require("express");
const participantAuthMiddleware = require("../middlewares/participant-auth.middleware");
const participantController = require("../controllers/participant.controller");

const router = express.Router();

router.post("/participants/refresh", participantController.refresh);
router.get("/participants/me/session-state", participantAuthMiddleware, participantController.getMySessionState);
router.put("/participants/me/session-state", participantAuthMiddleware, participantController.saveMySessionState);

module.exports = router;
