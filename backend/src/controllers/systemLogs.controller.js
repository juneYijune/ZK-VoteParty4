var systemLogsService = require("../services/systemLogs.service");

// 创建系统日志
async function create(req, res, next) {
  try {
    var payload = req.body;
    var result = await systemLogsService.createSystemLog(payload);
    res.json({ code: 0, message: "创建成功", data: result });
  } catch (e) {
    console.error(e);
    res.json({ code: 1, message: e.message || "创建失败" });
  }
}

// 获取系统日志列表
async function list(req, res, next) {
  try {
    var params = req.query;
    var result = await systemLogsService.listSystemLogs(params);
    res.json({ code: 0, message: "查询成功", data: result });
  } catch (e) {
    console.error(e);
    res.json({ code: 1, message: e.message || "查询失败" });
  }
}

// 获取日志统计信息
async function statistics(req, res, next) {
  try {
    var result = await systemLogsService.getLogStatistics();
    res.json({ code: 0, message: "查询成功", data: result });
  } catch (e) {
    console.error(e);
    res.json({ code: 1, message: e.message || "查询失败" });
  }
}

module.exports = {
  create,
  list,
  statistics,
};
