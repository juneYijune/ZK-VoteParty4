var { getMysqlPool, query } = require("../lib/mysql");
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

// 计算资格规则的 Poseidon Hash
async function calculateEligibilityRuleHash(eligibilityRule) {
  try {
    var poseidon = await initPoseidon();
    
    // 处理 org_code：可能是数字 0 或字符串
    var orgCodeNum = 0;
    if (eligibilityRule.require_org_code === 0) {
      // 如果是数字 0，直接使用
      orgCodeNum = 0;
    } else if (eligibilityRule.require_org_code) {
      // 如果是字符串，提取数字部分
      var orgCode = String(eligibilityRule.require_org_code).trim();
      if (orgCode) {
        var digits = orgCode.replace(/\D/g, '').slice(0, 10);
        orgCodeNum = digits ? parseInt(digits, 10) : 0;
      }
    }
    
    var ruleValues = [
      eligibilityRule.require_formal_member ? 1 : 0,
      eligibilityRule.min_party_years || 0,
      orgCodeNum,
      eligibilityRule.require_active_status ? 1 : 0,
      eligibilityRule.require_fee_paid ? 1 : 0,
      eligibilityRule.require_no_conflict ? 1 : 0,
    ];
    
    // 使用 Poseidon hash
    var hash = poseidon(ruleValues.map(v => BigInt(v)));
    
    // 转换为十六进制字符串
    var hashHex = poseidon.F.toString(hash, 16);
    
    // 补齐到64位（32字节）
    return "0x" + hashHex.padStart(64, "0");
  } catch (e) {
    console.error("Poseidon hash error:", e);
    console.warn("Falling back to plain JSON string");
    // 如果 Poseidon 失败，使用 JSON 字符串
    return JSON.stringify(eligibilityRule);
  }
}

async function createVoteAction(payload) {
  var pool = getMysqlPool();
  var conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 计算资格规则哈希
    var eligibilityRuleHash = await calculateEligibilityRuleHash(payload.eligibility_rule);

    var sql =
      "INSERT INTO votes (chain_vote_id, vote_title, vote_type, party_org_id, start_time, end_time, max_choices, description, description_cid, status, block_height, transaction_hash, eligibility_rule, eligibility_rule_hash) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    var values = [
      payload.chain_vote_id,
      payload.vote_title,
      payload.vote_type,
      payload.party_org_id,
      payload.start_time,
      payload.end_time,
      payload.max_choices,
      payload.description || null,
      payload.description_cid || null,
      payload.status === undefined || payload.status === null ? 0 : payload.status,
      payload.block_height || null,
      payload.transaction_hash || null,
      JSON.stringify(payload.eligibility_rule),
      eligibilityRuleHash,
    ];

    var res = await conn.query(sql, values);
    var insertId = res && res[0] && res[0].insertId;

    var options = Array.isArray(payload.options) ? payload.options : [];
    for (var i = 0; i < options.length; i++) {
      var text = options[i];
      await conn.query(
        "INSERT INTO vote_options (vote_id, option_index, option_text) VALUES (?, ?, ?)",
        [insertId, i, text]
      );
    }

    await conn.commit();
    return { vote_id: insertId, eligibility_rule_hash: eligibilityRuleHash };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (err) {
      // ignore
    }
    throw e;
  } finally {
    try {
      conn.release();
    } catch (err) {
      // ignore
    }
  }
}

async function listVoteActions(params) {
  var keyword = (params.keyword || "").trim();
  var status = params.status;
  var party_org_id = params.party_org_id;

  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "10", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 10;

  var where = [];
  var values = [];

  if (keyword) {
    where.push("(v.vote_title LIKE ? OR v.vote_type LIKE ? OR po.org_name LIKE ?)");
    var like = "%" + keyword + "%";
    values.push(like, like, like);
  }

  if (party_org_id !== undefined && party_org_id !== null && party_org_id !== "") {
    var orgId = parseInt(String(party_org_id), 10);
    if (Number.isFinite(orgId) && orgId > 0) {
      where.push("v.party_org_id = ?");
      values.push(orgId);
    }
  }

  if (status !== undefined && status !== null && status !== "") {
    var s = parseInt(String(status), 10);
    if (Number.isFinite(s)) {
      where.push("v.status = ?");
      values.push(s);
    }
  }

  var whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  var countSql = 
    "SELECT COUNT(1) AS total FROM votes v " +
    "LEFT JOIN party_orgs po ON v.party_org_id = po.org_id " +
    whereSql;
  var countRes = await query(countSql, values);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT v.vote_id, v.chain_vote_id, v.vote_title, v.vote_type, v.party_org_id, v.start_time, v.end_time, v.max_choices, v.description, v.description_cid, v.status, v.block_height, v.transaction_hash, v.eligibility_rule, v.eligibility_rule_hash, v.created_at, v.updated_at, " +
    "po.org_name, po.org_code, po.leader_name " +
    "FROM votes v LEFT JOIN party_orgs po ON v.party_org_id = po.org_id " +
    (whereSql ? whereSql + " " : "") +
    "ORDER BY v.vote_id DESC LIMIT ? OFFSET ?";

  var listValues = values.slice();
  listValues.push(pageSize, offset);

  var listRes = await query(listSql, listValues);
  var items = (listRes && listRes[0]) || [];

  // 解析每个投票的 eligibility_rule JSON
  for (var i = 0; i < items.length; i++) {
    if (items[i].eligibility_rule === null || items[i].eligibility_rule === undefined) {
      // 如果字段为 NULL，设置默认值
      items[i].eligibility_rule = {
        require_formal_member: false,
        min_party_years: 0,
        require_org_code: 0,
        require_active_status: false,
        require_fee_paid: false,
        require_no_conflict: false,
      };
    } else if (typeof items[i].eligibility_rule === 'string') {
      try {
        items[i].eligibility_rule = JSON.parse(items[i].eligibility_rule);
      } catch (e) {
        items[i].eligibility_rule = {
          require_formal_member: false,
          min_party_years: 0,
          require_org_code: 0,
          require_active_status: false,
          require_fee_paid: false,
          require_no_conflict: false,
        };
      }
    }
    // 如果已经是对象（某些 MySQL 驱动会自动解析 JSON），直接使用
  }

  var ids = items.map(function (it) {
    return it.vote_id;
  });

  if (ids.length) {
    var optRes = await query(
      "SELECT vote_id, option_index, option_text FROM vote_options WHERE vote_id IN (?) ORDER BY vote_id ASC, option_index ASC",
      [ids]
    );
    var optRows = (optRes && optRes[0]) || [];

    var map = {};
    for (var j = 0; j < optRows.length; j++) {
      var r = optRows[j];
      if (!map[r.vote_id]) map[r.vote_id] = [];
      map[r.vote_id].push({ option_index: r.option_index, option_text: r.option_text });
    }

    for (var k = 0; k < items.length; k++) {
      items[k].options = map[items[k].vote_id] || [];
    }
  } else {
    for (var kk = 0; kk < items.length; kk++) {
      items[kk].options = [];
    }
  }

  return {
    items: items,
    total: total,
    page: page,
    pageSize: pageSize,
  };
}

async function updateVoteStatusByChainId(payload) {
  var sql = "UPDATE votes SET status = ? WHERE chain_vote_id = ?";
  var values = [payload.status, payload.chain_vote_id];
  var res = await query(sql, values);
  var affected = res && res[0] && res[0].affectedRows;
  return affected > 0;
}

async function getVoteDetailById(vote_id) {
  var vid = parseInt(String(vote_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) return null;

  var voteRes = await query(
    "SELECT v.vote_id, v.chain_vote_id, v.vote_title, v.vote_type, v.party_org_id, v.start_time, v.end_time, v.max_choices, v.description, v.description_cid, v.status, v.block_height, v.transaction_hash, v.eligibility_rule, v.eligibility_rule_hash, v.created_at, v.updated_at, po.org_name, po.org_code, po.leader_name FROM votes v LEFT JOIN party_orgs po ON v.party_org_id = po.org_id WHERE v.vote_id = ?",
    [vid]
  );
  var vote = (voteRes && voteRes[0] && voteRes[0][0]) || null;
  if (!vote) return null;

  // 解析 eligibility_rule JSON
  if (vote.eligibility_rule && typeof vote.eligibility_rule === 'string') {
    try {
      vote.eligibility_rule = JSON.parse(vote.eligibility_rule);
    } catch (e) {
      vote.eligibility_rule = null;
    }
  }

  var optRes = await query(
    "SELECT vote_id, option_index, option_text FROM vote_options WHERE vote_id = ? ORDER BY option_index ASC",
    [vid]
  );
  vote.options = (optRes && optRes[0]) || [];

  return vote;
}

module.exports = {
  createVoteAction,
  listVoteActions,
  updateVoteStatusByChainId,
  getVoteDetailById,
  calculateEligibilityRuleHash,
};
