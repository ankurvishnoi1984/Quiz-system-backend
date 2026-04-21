const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { MediaAsset, Department, Client } = require("../models");
const { getMediaTypeFromMime, normalizeFilePath } = require("../utils/media");

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getDepartmentOrThrow(deptId) {
  const department = await Department.findByPk(Number(deptId), {
    include: [{ model: Client, attributes: ["client_id"] }]
  });
  if (!department) {
    throw createError("Department not found", 404);
  }
  return department;
}

function assertDepartmentAccess(user, department) {
  if (user.role === "super_admin") return;
  if (user.role === "client_admin" && Number(user.client_id) === Number(department.client_id)) return;
  if ((user.role === "dept_admin" || user.role === "host") && Number(user.dept_id) === Number(department.dept_id)) {
    return;
  }
  throw createError("Forbidden: media access denied", 403);
}

async function compressUploadedFile(file) {
  const mediaType = getMediaTypeFromMime(file.mimetype);
  if (mediaType === "video_file" || mediaType === "gif") {
    return { widthPx: null, heightPx: null, fileSizeBytes: file.size };
  }

  const sourcePath = file.path;
  const tempPath = `${sourcePath}.tmp`;

  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  let pipeline = sharp(sourcePath);

  if (file.mimetype === "image/png") {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else if (file.mimetype === "image/webp") {
    pipeline = pipeline.webp({ quality: 86 });
  } else {
    pipeline = pipeline.jpeg({ quality: 86, mozjpeg: true });
  }

  await pipeline.toFile(tempPath);
  await fs.rename(tempPath, sourcePath);

  const stats = await fs.stat(sourcePath);
  return {
    widthPx: metadata.width || null,
    heightPx: metadata.height || null,
    fileSizeBytes: stats.size
  };
}

async function uploadMediaAsset({ user, deptId, file }) {
  const department = await getDepartmentOrThrow(deptId);
  assertDepartmentAccess(user, department);

  const mediaType = getMediaTypeFromMime(file.mimetype);
  if (!mediaType) {
    throw createError("Unsupported media type", 400);
  }

  const absoluteUploadRoot = path.resolve(process.cwd(), "uploads");
  const normalizedAbsolutePath = normalizeFilePath(file.path);
  const filePath = `/${path.relative(process.cwd(), normalizedAbsolutePath).replaceAll(path.sep, "/")}`;

  if (!normalizedAbsolutePath.startsWith(normalizeFilePath(absoluteUploadRoot))) {
    throw createError("Invalid upload path generated", 500);
  }

  const compressedMetadata = await compressUploadedFile(file);

  return MediaAsset.create({
    dept_id: Number(deptId),
    uploaded_by: Number(user.user_id),
    original_filename: file.originalname,
    file_path: filePath,
    storage_key: null,
    cdn_url: null,
    media_type: mediaType,
    mime_type: file.mimetype,
    file_size_bytes: compressedMetadata.fileSizeBytes,
    width_px: compressedMetadata.widthPx,
    height_px: compressedMetadata.heightPx,
    duration_seconds: null,
    thumbnail_url: null,
    is_active: true
  });
}

async function listDepartmentMedia({ user, deptId }) {
  const department = await getDepartmentOrThrow(deptId);
  assertDepartmentAccess(user, department);
  return MediaAsset.findAll({
    where: { dept_id: Number(deptId), is_active: true },
    order: [["created_at", "DESC"]]
  });
}

async function deleteMediaAsset({ user, assetId, hardDelete = false }) {
  const mediaAsset = await MediaAsset.findByPk(Number(assetId));
  if (!mediaAsset) {
    throw createError("Media asset not found", 404);
  }

  const department = await getDepartmentOrThrow(mediaAsset.dept_id);
  assertDepartmentAccess(user, department);

  const absoluteFilePath = path.resolve(process.cwd(), mediaAsset.file_path.replace(/^\//, ""));
  if (!hardDelete) {
    mediaAsset.is_active = false;
    await mediaAsset.save();
    return;
  }

  await mediaAsset.destroy();

  try {
    await fs.unlink(absoluteFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw createError("Media deleted from database but file cleanup failed", 500);
    }
  }
}

module.exports = {
  uploadMediaAsset,
  listDepartmentMedia,
  deleteMediaAsset
};
