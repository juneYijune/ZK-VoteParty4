var { query } = require("../lib/mysql");

// 根据投票ID获取投票详情（包含选项）
async function getVoteDetailById(vote_id) {
  var vid = parseInt(String(vote_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) return null;

  // 查询投票基本信息
  var voteRes = await query(
    "SELECT vote_id, chain_vote_id, vote_title, vote_type, party_org_id, start_time, end_time, max_choices, description, description_cid, status, created_at, updated_at FROM votes WHERE vote_id = ?",
    [vid]
  );
  var vote = (voteRes && voteRes[0] && voteRes[0][0]) || null;
  if (!vote) return null;

  // 查询投票选项
  var optRes = await query(
    "SELECT vote_id, option_index, option_text FROM vote_options WHERE vote_id = ? ORDER BY option_index ASC",
    [vid]
  );
  vote.options = (optRes && optRes[0]) || [];

  return vote;
}

// 检查用户是否已对某投票投过票
async function hasVoted(vote_id, user_address) {
  var vid = parseInt(String(vote_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) return false;

  var res = await query("SELECT record_id FROM vote_records WHERE vote_id = ? AND user_address = ? LIMIT 1", [
    vid,
    user_address,
  ]);
  var row = (res && res[0] && res[0][0]) || null;
  return !!row;
}

// 记录投票到数据库（不再存储 selected_options）
async function recordVote(payload) {
  var sql =
    "INSERT INTO vote_records (vote_id, user_address, tx_hash, block_number, block_timestamp) VALUES (?, ?, ?, ?, ?)";

  var res = await query(sql, [
    payload.vote_id,
    payload.user_address,
    payload.tx_hash,
    payload.block_number,
    payload.block_timestamp,
  ]);

  var insertId = res && res[0] && res[0].insertId;
  return { record_id: insertId };
}

// 获取用户的投票记录列表（分页）
async function listMyVoteRecords(params) {
  var user_address = params.user_address;

  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "10", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 10;

  var countRes = await query("SELECT COUNT(1) AS total FROM vote_records WHERE user_address = ?", [user_address]);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT vr.record_id, vr.vote_id, vr.user_address, vr.tx_hash, vr.block_number, vr.block_timestamp, vr.created_at, " +
    "v.vote_title, v.vote_type, v.party_org_id, v.start_time, v.end_time, v.max_choices, v.status, " +
    "po.org_name, po.org_code, po.leader_name " +
    "FROM vote_records vr " +
    "LEFT JOIN votes v ON vr.vote_id = v.vote_id " +
    "LEFT JOIN party_orgs po ON v.party_org_id = po.org_id " +
    "WHERE vr.user_address = ? ORDER BY vr.record_id DESC LIMIT ? OFFSET ?";

  var listRes = await query(listSql, [user_address, pageSize, offset]);
  var items = (listRes && listRes[0]) || [];

  // 注意：selected_options 字段已从数据库删除，不再显示具体选择的选项
  // 如需查看选择的选项，需要从链上查询

  return { items: items, total: total, page: page, pageSize: pageSize };
}

// 获取投票记录详情（包含投票信息和党组织信息）
async function getVoteRecordDetail(record_id) {
  var rid = parseInt(String(record_id || ""), 10);
  if (!Number.isFinite(rid) || rid <= 0) return null;

  // 查询投票记录及关联的投票信息和党组织信息
  var sql =
    "SELECT vr.record_id, vr.vote_id, vr.user_address, vr.tx_hash, vr.block_number, vr.block_timestamp, vr.created_at, " +
    "v.chain_vote_id, v.vote_title, v.vote_type, v.party_org_id, v.start_time, v.end_time, v.max_choices, v.status, v.description, " +
    "po.org_name, po.org_code, po.leader_name " +
    "FROM vote_records vr " +
    "LEFT JOIN votes v ON vr.vote_id = v.vote_id " +
    "LEFT JOIN party_orgs po ON v.party_org_id = po.org_id " +
    "WHERE vr.record_id = ?";

  var res = await query(sql, [rid]);
  var record = (res && res[0] && res[0][0]) || null;
  if (!record) return null;

  // 注意：selected_options 字段已从数据库删除，不再显示具体选择的选项
  // 投票选择使用零知识证明保护隐私，完全保密
  record.selected_options_array = [];
  record.selected_option_texts = "（投票内容保密）";

  // 查询该投票的所有选项
  var optRes = await query(
    "SELECT vote_id, option_index, option_text FROM vote_options WHERE vote_id = ? ORDER BY option_index ASC",
    [record.vote_id]
  );
  var options = (optRes && optRes[0]) || [];
  record.options = options;

  return record;
}

module.exports = {
  getVoteDetailById,
  hasVoted,
  recordVote,
  listMyVoteRecords,
  getVoteRecordDetail,
};
