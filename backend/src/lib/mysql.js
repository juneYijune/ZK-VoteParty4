var mysql = require("mysql2/promise");

var pool;

function getMysqlPool() {
  // 中文说明：使用连接池复用连接，避免每次请求新建连接导致性能/资源问题。
  // 注意：这里不在 require 时立即连接，避免在未配置环境变量时启动直接崩。
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),
    queueLimit: 0,
    timezone: "+08:00",
  });

  return pool;
}

async function query(sql, params) {
  var p = getMysqlPool();
  return p.query(sql, params);
}

module.exports = {
  getMysqlPool,
  query,
};
