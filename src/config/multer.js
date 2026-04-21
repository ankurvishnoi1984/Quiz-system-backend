const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { getMediaTypeFromMime, getStorageFolderFromMime } = require("../utils/media");

const uploadsRoot = path.resolve(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderName = getStorageFolderFromMime(file.mimetype);
    const destinationPath = path.join(uploadsRoot, folderName);
    fs.mkdirSync(destinationPath, { recursive: true });
    cb(null, destinationPath);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const mediaType = getMediaTypeFromMime(file.mimetype);
  if (!mediaType) {
    return cb(new Error("Only image and video files are allowed"));
  }
  return cb(null, true);
};

const uploadMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = {
  uploadMedia
};
