var voteActionService = require("../services/voteAction.service");

function isDigits(v) {
  return typeof v === "string" && /^[0-9]+$/.test(v);
}

function parseDateTime(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    var d1 = new Date(v);
    if (Number.isFinite(d1.getTime())) return d1;
    return null;
  }
  if (typeof v === "string") {
    var s = v.trim();
    if (!s) return null;
    if (s && !s.includes("T") && s.includes(" ")) s = s.replace(" ", "T");
    var d2 = new Date(s);
    if (Number.isFinite(d2.getTime())) return d2;
    return null;
  }
  return null;
}

function normalizeVoteType(v) {
  if (v === 0 || v === 1 || v === 2) {
    return v === 0 ? "ELECTION" : v === 1 ? "RESOLUTION" : "EVALUATION";
  }

  var s = String(v || "").trim().toUpperCase();
  if (s === "ELECTION" || s === "RESOLUTION" || s === "EVALUATION") return s;
  return "";
}

async function add(req, res) {
  try {
    var body = req.body || {};

    var chain_vote_id = body.chain_vote_id;
    if (typeof chain_vote_id === "number") chain_vote_id = String(chain_vote_id);
    if (typeof chain_vote_id === "bigint") chain_vote_id = chain_vote_id.toString();

    if (!chain_vote_id || (typeof chain_vote_id !== "string" && typeof chain_vote_id !== "number")) {
      return res.status(400).json({ message: "invalid chain_vote_id" });
    }

    if (typeof chain_vote_id !== "string") chain_vote_id = String(chain_vote_id);
    chain_vote_id = chain_vote_id.trim();
    if (!isDigits(chain_vote_id) || chain_vote_id === "0") {
      return res.status(400).json({ message: "invalid chain_vote_id" });
    }

    var vote_title = body.vote_title;
    if (!vote_title || typeof vote_title !== "string") {
      return res.status(400).json({ message: "invalid vote_title" });
    }

    var vote_type = normalizeVoteType(body.vote_type);
    if (!vote_type) {
      return res.status(400).json({ message: "invalid vote_type" });
    }

    var party_org_id = parseInt(String(body.party_org_id || ""), 10);
    if (!Number.isFinite(party_org_id) || party_org_id <= 0) {
      return res.status(400).json({ message: "invalid party_org_id" });
    }

    var startTime = parseDateTime(body.start_time);
    var endTime = parseDateTime(body.end_time);
    if (!startTime) return res.status(400).json({ message: "invalid start_time" });
    if (!endTime) return res.status(400).json({ message: "invalid end_time" });
    if (startTime.getTime() >= endTime.getTime()) {
      return res.status(400).json({ message: "start_time must be earlier than end_time" });
    }

    var max_choices = parseInt(String(body.max_choices || ""), 10);
    if (!Number.isFinite(max_choices) || max_choices <= 0) {
      return res.status(400).json({ message: "invalid max_choices" });
    }

    var options = body.options;
    if (!Array.isArray(options) || options.length < 1) {
      return res.status(400).json({ message: "invalid options" });
    }

    var normalizedOptions = [];
    for (var i = 0; i < options.length; i++) {
      var t = options[i];
      if (!t || typeof t !== "string" || !t.trim()) {
        return res.status(400).json({ message: "invalid options" });
      }
      normalizedOptions.push(t.trim());
    }

    if (normalizedOptions.length < 1) {
      return res.status(400).json({ message: "invalid options" });
    }

    if (max_choices > normalizedOptions.length) {
      return res.status(400).json({ message: "max_choices cannot exceed options length" });
    }

    // 验证资格规则
    var eligibility_rule = body.eligibility_rule;
    if (!eligibility_rule || typeof eligibility_rule !== "object") {
      return res.status(400).json({ message: "invalid eligibility_rule" });
    }

    // 处理 require_org_code：空字符串转换为 0，否则保留字符串
    var orgCode = String(eligibility_rule.require_org_code || "").trim();
    var orgCodeValue = orgCode ? orgCode : 0;

    // 验证资格规则的6个字段
    var validatedRule = {
      require_formal_member: !!eligibility_rule.require_formal_member,
      min_party_years: parseInt(String(eligibility_rule.min_party_years || "0"), 10),
      require_org_code: orgCodeValue,
      require_active_status: !!eligibility_rule.require_active_status,
      require_fee_paid: !!eligibility_rule.require_fee_paid,
      require_no_conflict: !!eligibility_rule.require_no_conflict,
    };

    // 确保 min_party_years 是有效数字
    if (!Number.isFinite(validatedRule.min_party_years) || validatedRule.min_party_years < 0) {
      validatedRule.min_party_years = 0;
    }

    var status = body.status;
    if (status === undefined || status === null || status === "") status = 0;
    var statusInt = parseInt(String(status), 10);
    if (!Number.isFinite(statusInt)) statusInt = 0;

    var payload = {
      chain_vote_id: chain_vote_id,
      vote_title: vote_title.trim(),
      vote_type: vote_type,
      party_org_id: party_org_id,
      start_time: startTime,
      end_time: endTime,
      max_choices: max_choices,
      description: body.description,
      description_cid: body.description_cid,
      status: statusInt,
      options: normalizedOptions,
      eligibility_rule: validatedRule,
      block_height: body.block_height || null,
      transaction_hash: body.transaction_hash || null,
    };

    if (payload.block_height !== null && payload.block_height !== undefined && payload.block_height !== "") {
      var bh = parseInt(String(payload.block_height), 10);
      if (!Number.isFinite(bh) || bh <= 0) {
        return res.status(400).json({ message: "invalid block_height" });
      }
      payload.block_height = bh;
    } else {
      payload.block_height = null;
    }

    if (payload.transaction_hash !== null && payload.transaction_hash !== undefined && payload.transaction_hash !== "") {
      var th = String(payload.transaction_hash).trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(th)) {
        return res.status(400).json({ message: "invalid transaction_hash" });
      }
      payload.transaction_hash = th;
    } else {
      payload.transaction_hash = null;
    }

    var created = await voteActionService.createVoteAction(payload);
    return res.status(201).json({ 
      ok: true, 
      vote_id: created.vote_id, 
      chain_vote_id: chain_vote_id,
      eligibility_rule_hash: created.eligibility_rule_hash 
    });
  } catch (e) {
    console.error("[voteAction] add error", e);
    return res.status(500).json({ message: "server error" });
  }
}

async function list(req, res) {
  try {
    var result = await voteActionService.listVoteActions({
      keyword: req.query && req.query.keyword,
      status: req.query && req.query.status,
      party_org_id: req.query && req.query.party_org_id,
      page: req.query && req.query.page,
      pageSize: req.query && req.query.pageSize,
    });

    return res.json(result);
  } catch (e) {
    console.error("[voteAction] list error", e);
    return res.status(500).json({ message: "server error" });
  }
}

async function detail(req, res) {
  try {
    var vote_id = req.params && req.params.vote_id;
    var vid = parseInt(String(vote_id || ""), 10);
    if (!Number.isFinite(vid) || vid <= 0) {
      return res.status(400).json({ message: "invalid vote_id" });
    }

    var vote = await voteActionService.getVoteDetailById(vid);
    if (!vote) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json(vote);
  } catch (e) {
    console.error("[voteAction] detail error", e);
    return res.status(500).json({ message: "server error" });
  }
}

async function updateStatus(req, res) {
  try {
    var body = req.body || {};

    var chain_vote_id = body.chain_vote_id;
    if (typeof chain_vote_id === "number") chain_vote_id = String(chain_vote_id);
    if (typeof chain_vote_id === "bigint") chain_vote_id = chain_vote_id.toString();

    if (!chain_vote_id || (typeof chain_vote_id !== "string" && typeof chain_vote_id !== "number")) {
      return res.status(400).json({ message: "invalid chain_vote_id" });
    }
    if (typeof chain_vote_id !== "string") chain_vote_id = String(chain_vote_id);
    chain_vote_id = chain_vote_id.trim();
    if (!isDigits(chain_vote_id) || chain_vote_id === "0") {
      return res.status(400).json({ message: "invalid chain_vote_id" });
    }

    var statusInt = parseInt(String(body.status ?? ""), 10);
    if (!(statusInt === 0 || statusInt === 1 || statusInt === 2)) {
      return res.status(400).json({ message: "invalid status" });
    }

    var payload = {
      chain_vote_id: chain_vote_id,
      status: statusInt,
    };

    var updated = await voteActionService.updateVoteStatusByChainId(payload);
    if (!updated) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[voteAction] updateStatus error", e);
    return res.status(500).json({ message: "server error" });
  }
}

async function calculateHash(req, res) {
  try {
    var body = req.body || {};
    var eligibility_rule = body.eligibility_rule;

    if (!eligibility_rule || typeof eligibility_rule !== "object") {
      return res.status(400).json({ message: "invalid eligibility_rule" });
    }

    // 处理 require_org_code：空字符串转换为 0，否则保留字符串
    var orgCode = String(eligibility_rule.require_org_code || "").trim();
    var orgCodeValue = orgCode ? orgCode : 0;

    // 验证资格规则的6个字段
    var validatedRule = {
      require_formal_member: !!eligibility_rule.require_formal_member,
      min_party_years: parseInt(String(eligibility_rule.min_party_years || "0"), 10),
      require_org_code: orgCodeValue,
      require_active_status: !!eligibility_rule.require_active_status,
      require_fee_paid: !!eligibility_rule.require_fee_paid,
      require_no_conflict: !!eligibility_rule.require_no_conflict,
    };

    // 确保 min_party_years 是有效数字
    if (!Number.isFinite(validatedRule.min_party_years) || validatedRule.min_party_years < 0) {
      validatedRule.min_party_years = 0;
    }

    var hash = await voteActionService.calculateEligibilityRuleHash(validatedRule);
    return res.json({ hash: hash });
  } catch (e) {
    console.error("[voteAction] calculateHash error", e);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = {
  add,
  list,
  detail,
  updateStatus,
  calculateHash,
};
