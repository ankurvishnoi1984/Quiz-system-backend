const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const apiRoutes = require("./routes");
const { errorResponse } = require("./utils/response");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", apiRoutes);

app.use((_req, res) => {
  return errorResponse(res, "Route not found", 404);
});

module.exports = app;
