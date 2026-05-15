var { query } = require("../lib/mysql");
var crypto = require("crypto");
var { buildPoseidon } = require("circomlibjs");

// 全局 Poseidon 实例
var poseidonInstance = null;

// 初始化 Poseidon
async function initPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

// SHA-256 哈希
function sha256Hash(data) {
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

// Poseidon Hash - 将以太坊地址转换为 Poseidon Hash
async function poseidonHashAddress(address) {
  try {
    var poseidon = await initPoseidon();
    
    // 移除 0x 前缀
    var cleanAddress = address.toLowerCase().replace("0x", "");
    
    // 将地址分成两部分（每部分20字节 = 160位）
    // 以太坊地址是40个十六进制字符（20字节）
    var part1 = BigInt("0x" + cleanAddress.slice(0, 32)); // 前16字节
    var part2 = BigInt("0x" + cleanAddress.slice(32)); // 后4字节
    
    // 使用 Poseidon hash
    var hash = poseidon([part1, part2]);
    
    // 转换为十六进制字符串
    var hashHex = poseidon.F.toString(hash, 16);
    
    // 补齐到64位（32字节）
    return "0x" + hashHex.padStart(64, "0");
  } catch (e) {
    console.error("Poseidon hash error:", e);
    console.warn("Falling back to plain address (no hash)");
    // 如果 Poseidon 失败，使用明文地址
    return address;
  }
}

// 根据钱包地址获取用户信息
async function getUserByWalletAddress(walletAddress) {
  var sql =
    "SELECT pu.partyuser_id, pu.user_name, pu.id_number_hash, pu.wallet_address, pu.wallet_address_hash, " +
    "pu.user_role, pu.party_org_id, pu.user_status, pu.created_at, pu.updated_at, " +
    "po.org_name, po.org_code, po.leader_name " +
    "FROM party_users pu " +
    "LEFT JOIN party_orgs po ON pu.party_org_id = po.org_id " +
    "WHERE pu.wallet_address = ? LIMIT 1";

  var res = await query(sql, [walletAddress]);
  var row = res && res[0] && res[0][0];
  return row || null;
}

// 创建党员申请
async function createPartyUserApplication(payload) {
  // 生成哈希
  var idNumberHash = payload.id_number ? sha256Hash(payload.id_number) : null;
  var walletAddressHash = payload.wallet_address ? await poseidonHashAddress(payload.wallet_address) : null;

  var sql =
    "INSERT INTO party_users (user_name, id_number_hash, wallet_address, wallet_address_hash, user_role, party_org_id, user_status) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?)";

  var values = [
    payload.user_name,
    idNumberHash,
    payload.wallet_address,
    walletAddressHash,
    1, // 默认角色为党员
    payload.party_org_id,
    2, // 默认状态为申请中
  ];

  var res = await query(sql, values);
  var insertId = res && res[0] && res[0].insertId;

  return { partyuser_id: insertId };
}

// 获取党组织的申请列表
async function listApplicationsByOrgId(orgId, params) {
  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "10", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 10;

  var where = "WHERE pu.party_org_id = ? AND pu.user_status = 2";
  var values = [orgId];

  var countSql =
    "SELECT COUNT(1) AS total FROM party_users pu " + where;
  var countRes = await query(countSql, values);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT pu.partyuser_id, pu.user_name, pu.wallet_address, pu.user_status, pu.created_at, pu.updated_at " +
    "FROM party_users pu " +
    where +
    " ORDER BY pu.created_at DESC LIMIT ? OFFSET ?";

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

// 审批申请（同意或拒绝）
async function approveApplication(payload) {
  if (payload.user_status === 0) {
    // 拒绝申请：删除用户记录
    var sql = "DELETE FROM party_users WHERE partyuser_id = ? AND user_status = 2";
    var values = [payload.partyuser_id];
    var res = await query(sql, values);
    var affected = res && res[0] && res[0].affectedRows;
    return affected > 0;
  } else {
    // 同意申请：更新状态为正常
    var sql = "UPDATE party_users SET user_status = ? WHERE partyuser_id = ? AND user_status = 2";
    var values = [payload.user_status, payload.partyuser_id];
    var res = await query(sql, values);
    var affected = res && res[0] && res[0].affectedRows;
    return affected > 0;
  }
}

// 获取用户的党组织信息
async function getUserPartyOrg(walletAddress) {
  var user = await getUserByWalletAddress(walletAddress);
  if (!user) return null;

  return {
    partyuser_id: user.partyuser_id,
    user_name: user.user_name,
    user_status: user.user_status,
    party_org_id: user.party_org_id,
    org_name: user.org_name,
    org_code: user.org_code,
    leader_name: user.leader_name,
  };
}

// 获取党组织的成员列表
async function listMembersByOrgId(orgId, params) {
  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "10", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 10;

  var where = "WHERE pu.party_org_id = ? AND pu.user_status = 1";
  var values = [orgId];

  var countSql =
    "SELECT COUNT(1) AS total FROM party_users pu " + where;
  var countRes = await query(countSql, values);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT pu.partyuser_id, pu.user_name, pu.wallet_address_hash, pu.user_role, pu.user_status, pu.created_at " +
    "FROM party_users pu " +
    where +
    " ORDER BY pu.created_at DESC LIMIT ? OFFSET ?";

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

// 从党组织中移除成员
async function removeMemberFromOrg(partyuserId, orgId) {
  var sql = "DELETE FROM party_users WHERE partyuser_id = ? AND party_org_id = ? AND user_status = 1";
  var values = [partyuserId, orgId];
  var res = await query(sql, values);
  var affected = res && res[0] && res[0].affectedRows;
  return affected > 0;
}

module.exports = {
  poseidonHashAddress,
  getUserByWalletAddress,
  createPartyUserApplication,
  listApplicationsByOrgId,
  approveApplication,
  getUserPartyOrg,
  listMembersByOrgId,
  removeMemberFromOrg,
};
