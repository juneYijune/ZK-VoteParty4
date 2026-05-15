var express = require("express");
var router = express.Router();

var systemLogsController = require("../controllers/systemLogs.controller");

// 创建系统日志
router.post("/create", systemLogsController.create);

// 获取系统日志列表
router.get("/list", systemLogsController.list);

// 获取日志统计信息
router.get("/statistics", systemLogsController.statistics);

module.exports = router;
