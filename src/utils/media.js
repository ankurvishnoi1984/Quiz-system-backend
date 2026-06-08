const path = require("path");

const MEDIA_TYPE = {
  IMAGE: "image",
  GIF: "gif",
  VIDEO: "video_file",
  AUDIO: "audio_file"
};

function getMediaTypeFromMime(mimeType) {
  if (!mimeType || typeof mimeType !== "string") return null;
  if (mimeType === "image/gif") return MEDIA_TYPE.GIF;
  if (mimeType.startsWith("image/")) return MEDIA_TYPE.IMAGE;
  if (mimeType.startsWith("video/")) return MEDIA_TYPE.VIDEO;
  if (mimeType.startsWith("audio/")) return MEDIA_TYPE.AUDIO;
  return null;
}

function getStorageFolderFromMime(mimeType) {
  const mediaType = getMediaTypeFromMime(mimeType);
  if (mediaType === MEDIA_TYPE.VIDEO) return "videos";
  if (mediaType === MEDIA_TYPE.AUDIO) return "audio";
  return "images";
}

function normalizeFilePath(fileSystemPath) {
  return fileSystemPath.replaceAll(path.sep, "/");
}

function buildFileUrl(req, filePath) {
  return `${req.protocol}://${req.get("host")}${filePath}`;
}

module.exports = {
  MEDIA_TYPE,
  getMediaTypeFromMime,
  getStorageFolderFromMime,
  normalizeFilePath,
  buildFileUrl
};
