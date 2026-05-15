var { query } = require("../lib/mysql");

// 创建系统日志
async function createSystemLog(payload) {
  var sql =
    "INSERT INTO system_logs (log_type, operator_address, target_address, vote_id, action_desc, logs_status, tx_hash, block_number, block_timestamp) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

  var values = [
    payload.log_type,
    payload.operator_address,
    payload.target_address || null,
    payload.vote_id || null,
    payload.action_desc || null,
    payload.logs_status || 0,
    payload.tx_hash,
    payload.block_number,
    payload.block_timestamp,
  ];

  var res = await query(sql, values);
  var insertId = res && res[0] && res[0].insertId;

  return { log_id: insertId };
}

// 获取系统日志列表（分页、筛选）
async function listSystemLogs(params) {
  var log_type = params.log_type;
  var operator_address = params.operator_address;
  var start_date = params.start_date;
  var end_date = params.end_date;

  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "20", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 20;

  var where = [];
  var values = [];

  // 按日志类型筛选
  if (log_type && log_type !== "all") {
    where.push("log_type = ?");
    values.push(log_type);
  }

  // 按操作人地址筛选
  if (operator_address) {
    where.push("operator_address = ?");
    values.push(operator_address);
  }

  // 按时间范围筛选
  if (start_date) {
    where.push("FROM_UNIXTIME(block_timestamp) >= ?");
    values.push(start_date);
  }
  if (end_date) {
    where.push("FROM_UNIXTIME(block_timestamp) <= ?");
    values.push(end_date);
  }

  var whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  // 查询总数
  var countSql = "SELECT COUNT(1) AS total FROM system_logs " + whereSql;
  var countRes = await query(countSql, values);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  // 查询列表
  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT log_id, log_type, operator_address, target_address, vote_id, action_desc, logs_status, tx_hash, block_number, block_timestamp, created_at " +
    "FROM system_logs " +
    whereSql +
    " ORDER BY block_timestamp DESC, log_id DESC LIMIT ? OFFSET ?";

  var listValues = values.slice();
  listValues.push(pageSize, offset);

  var listRes = await query(listSql, listValues);
  var items = (listRes && listRes[0]) || [];

  return {
    items: items,
    total: total,
    page: page,
    pageSize: pageSize,
  };
}

// 根据交易哈希查询日志
async function getLogByTxHash(tx_hash) {
  var sql =
    "SELECT log_id, log_type, operator_address, target_address, vote_id, action_desc, logs_status, tx_hash, block_number, block_timestamp, created_at " +
    "FROM system_logs WHERE tx_hash = ? LIMIT 1";

  var res = await query(sql, [tx_hash]);
  var row = res && res[0] && res[0][0];
  return row || null;
}

// 获取日志统计信息
async function getLogStatistics() {
  var sql = "SELECT log_type, COUNT(1) AS count FROM system_logs GROUP BY log_type";

  var res = await query(sql);
  var rows = (res && res[0]) || [];

  var stats = {};
  for (var i = 0; i < rows.length; i++) {
    stats[rows[i].log_type] = rows[i].count;
  }

  return stats;
}

module.exports = {
  createSystemLog,
  listSystemLogs,
  getLogByTxHash,
  getLogStatistics,
};
