var { query } = require("../lib/mysql");

// 获取党组织列表（支持关键词搜索和状态筛选）
async function listPartyOrgs(params) {
  var keyword = (params.keyword || "").trim();
  var status = params.status;

  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "10", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 10;

  var where = [];
  var values = [];

  if (keyword) {
    where.push("(org_name LIKE ? OR org_code LIKE ? OR leader_name LIKE ? OR orger_address LIKE ?)");
    var like = "%" + keyword + "%";
    values.push(like, like, like, like);
  }

  if (status !== undefined && status !== null && status !== "") {
    var s = parseInt(String(status), 10);
    if (s === 0 || s === 1) {
      where.push("status = ?");
      values.push(s);
    }
  }

  var whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  var countSql = "SELECT COUNT(1) AS total FROM party_orgs " + whereSql;
  var countRes = await query(countSql, values);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT org_id, org_name, org_code, org_type, leader_name, orger_address, description, description_cid, status, block_height, transaction_hash, created_at, updated_at " +
    "FROM party_orgs " +
    whereSql +
    " ORDER BY org_id DESC LIMIT ? OFFSET ?";

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

// 创建党组织
async function createPartyOrg(payload) {
  var sql =
    "INSERT INTO party_orgs (org_name, org_code, org_type, leader_name, orger_address, description, description_cid, status, block_height, transaction_hash) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

  var values = [
    payload.org_name,
    payload.org_code,
    payload.org_type || null,
    payload.leader_name || null,
    payload.orger_address,
    payload.description || null,
    payload.description_cid || null,
    payload.status === 0 ? 0 : 1,
    payload.block_height || null,
    payload.transaction_hash || null,
  ];

  var res = await query(sql, values);
  var insertId = res && res[0] && res[0].insertId;

  return { org_id: insertId };
}

// 根据ID获取党组织详情
async function getPartyOrgById(org_id) {
  var sql =
    "SELECT org_id, org_name, org_code, org_type, leader_name, orger_address, description, description_cid, status, block_height, transaction_hash, created_at, updated_at " +
    "FROM party_orgs WHERE org_id = ? LIMIT 1";

  var res = await query(sql, [org_id]);
  var row = res && res[0] && res[0][0];
  return row || null;
}

// 更新党组织链下信息（不包括管理员地址和链上信息）
async function updatePartyOrgOffchain(payload) {
  var org_id = payload.org_id;

  var sets = [];
  var values = [];

  if (payload.org_name !== undefined) {
    sets.push("org_name = ?");
    values.push(payload.org_name);
  }
  if (payload.org_code !== undefined) {
    sets.push("org_code = ?");
    values.push(payload.org_code);
  }
  if (payload.org_type !== undefined) {
    sets.push("org_type = ?");
    values.push(payload.org_type || null);
  }
  if (payload.leader_name !== undefined) {
    sets.push("leader_name = ?");
    values.push(payload.leader_name || null);
  }
  if (payload.description !== undefined) {
    sets.push("description = ?");
    values.push(payload.description || null);
  }
  if (payload.description_cid !== undefined) {
    sets.push("description_cid = ?");
    values.push(payload.description_cid || null);
  }
  if (payload.status !== undefined) {
    sets.push("status = ?");
    values.push(payload.status === 0 ? 0 : 1);
  }

  if (!sets.length) {
    return true;
  }

  values.push(org_id);

  var sql = `UPDATE party_orgs SET ${sets.join(", ")} WHERE org_id = ?`;
  var res = await query(sql, values);
  var affected = res && res[0] && res[0].affectedRows;
  return affected > 0;
}

// 根据管理员地址撤销党组织管理员
async function revokePartyOrgAdminByAddress(payload) {
  var sql =
    "UPDATE party_orgs SET orger_address = NULL, status = 0, block_height = ?, transaction_hash = ? WHERE orger_address = ?";

  var values = [payload.block_height || null, payload.transaction_hash || null, payload.orger_address];
  var res = await query(sql, values);
  var affected = res && res[0] && res[0].affectedRows;
  return affected > 0;
}

// 更新党组织管理员地址
async function updatePartyOrgAdminAddress(payload) {
  // 构建动态 SQL
  var fields = ["orger_address = ?", "block_height = ?", "transaction_hash = ?"];
  var values = [
    payload.orger_address,
    payload.block_height || null,
    payload.transaction_hash || null,
  ];

  // 如果提供了 status，也更新状态
  if (payload.status !== undefined && payload.status !== null) {
    fields.push("status = ?");
    values.push(payload.status);
  }

  values.push(payload.org_id);

  var sql = "UPDATE party_orgs SET " + fields.join(", ") + " WHERE org_id = ?";

  var res = await query(sql, values);
  var affected = res && res[0] && res[0].affectedRows;
  return affected > 0;
}

// 根据管理员地址获取党组织信息
async function getPartyOrgByAddress(address) {
  var sql =
    "SELECT org_id, org_name, org_code, org_type, leader_name, orger_address, description, description_cid, status, block_height, transaction_hash, created_at, updated_at " +
    "FROM party_orgs WHERE orger_address = ? LIMIT 1";

  var res = await query(sql, [address]);
  var row = res && res[0] && res[0][0];
  return row || null;
}

module.exports = {
  listPartyOrgs,
  createPartyOrg,
  getPartyOrgById,
  getPartyOrgByAddress,
  updatePartyOrgOffchain,
  updatePartyOrgAdminAddress,
  revokePartyOrgAdminByAddress,
};
