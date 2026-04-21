const { successResponse, errorResponse } = require("../utils/response");
const {
  uploadMediaAsset,
  listDepartmentMedia,
  deleteMediaAsset
} = require("../services/media.service");
const { buildFileUrl } = require("../utils/media");
const { validateMediaUploadPayload } = require("../validators/media.validator");

async function upload(req, res) {
  try {
    const validationErrors = validateMediaUploadPayload(req.body);
    if (validationErrors.length > 0) {
      return errorResponse(res, "Validation failed", 400, validationErrors);
    }
    if (!req.file) {
      return errorResponse(res, "file is required", 400);
    }

    const asset = await uploadMediaAsset({
      user: req.user,
      deptId: req.body.dept_id,
      file: req.file
    });

    return successResponse(
      res,
      {
        asset_id: asset.asset_id,
        file_url: buildFileUrl(req, asset.file_path)
      },
      "Media uploaded successfully",
      201
    );
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function listByDepartment(req, res) {
  try {
    const deptId = Number(req.params.deptId);
    if (Number.isNaN(deptId)) {
      return errorResponse(res, "deptId must be a number", 400);
    }

    const mediaAssets = await listDepartmentMedia({
      user: req.user,
      deptId
    });

    const data = mediaAssets.map((asset) => ({
      ...asset.toJSON(),
      file_url: buildFileUrl(req, asset.file_path)
    }));

    return successResponse(res, { media_assets: data }, "Media fetched successfully", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

async function remove(req, res) {
  try {
    const assetId = Number(req.params.assetId);
    if (Number.isNaN(assetId)) {
      return errorResponse(res, "assetId must be a number", 400);
    }

    await deleteMediaAsset({
      user: req.user,
      assetId,
      hardDelete: String(req.query.hard_delete || "").toLowerCase() === "true"
    });

    return successResponse(res, {}, "Media removed successfully", 200);
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
}

module.exports = {
  upload,
  listByDepartment,
  remove
};
