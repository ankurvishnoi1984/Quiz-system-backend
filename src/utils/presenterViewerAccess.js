function assertPresenterViewerSession(viewer, sessionId) {
  if (!viewer || viewer.role !== "presenter_viewer") {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }
  if (Number(viewer.session_id) !== Number(sessionId)) {
    const error = new Error("Forbidden: session access denied");
    error.statusCode = 403;
    throw error;
  }
}

module.exports = {
  assertPresenterViewerSession
};
