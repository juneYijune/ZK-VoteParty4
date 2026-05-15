var { ethers } = require("ethers");
var voteRecordsService = require("../services/voteRecords.service");

// 解析选择的选项（支持数组或逗号分隔的字符串）
function parseSelectedOptions(v) {
  if (Array.isArray(v)) {
    return v
      .map(function (x) {
        return parseInt(String(x), 10);
      })
      .filter(function (n) {
        return Number.isFinite(n) && n >= 0;
      });
  }

  if (typeof v === "string") {
    var s = v.trim();
    if (!s) return [];
    return s
      .split(",")
      .map(function (x) {
        return parseInt(x.trim(), 10);
      })
      .filter(function (n) {
        return Number.isFinite(n) && n >= 0;
      });
  }

  return [];
}

// 数组去重
function uniqNums(nums) {
  var map = {};
  var out = [];
  for (var i = 0; i < nums.length; i++) {
    var n = nums[i];
    var k = String(n);
    if (map[k]) continue;
    map[k] = true;
    out.push(n);
  }
  return out;
}

// 记录投票
// 记录投票
async function record(req, res) {
  try {
    var body = req.body || {};

    // 验证投票ID
    var vote_id = parseInt(String(body.vote_id || ""), 10);
    if (!Number.isFinite(vote_id) || vote_id <= 0) {
      return res.status(400).json({ message: "invalid vote_id" });
    }

    // 验证用户地址
    var user_address = body.user_address;
    if (!user_address || typeof user_address !== "string" || !ethers.isAddress(user_address)) {
      return res.status(400).json({ message: "invalid user_address" });
    }
    user_address = ethers.getAddress(user_address);

    // 验证交易哈希
    var tx_hash = body.tx_hash;
    if (!tx_hash || typeof tx_hash !== "string") {
      return res.status(400).json({ message: "invalid tx_hash" });
    }
    tx_hash = tx_hash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx_hash)) {
      return res.status(400).json({ message: "invalid tx_hash" });
    }

    // 验证区块高度
    var block_number = parseInt(String(body.block_number ?? ""), 10);
    if (!Number.isFinite(block_number) || block_number <= 0) {
      return res.status(400).json({ message: "invalid block_number" });
    }

    // 验证区块时间戳
    var block_timestamp = parseInt(String(body.block_timestamp ?? ""), 10);
    if (!Number.isFinite(block_timestamp) || block_timestamp <= 0) {
      return res.status(400).json({ message: "invalid block_timestamp" });
    }

    // 解析并验证选择的选项（用于验证，但不存储到数据库）
    var selected = uniqNums(parseSelectedOptions(body.selected_options));
    if (!selected.length) {
      return res.status(400).json({ message: "invalid selected_options" });
    }

    // 获取投票详情
    var vote = await voteRecordsService.getVoteDetailById(vote_id);
    if (!vote) {
      return res.status(404).json({ message: "vote not found" });
    }

    // 检查投票状态
    if (!(vote.status === 1 || vote.status === "1")) {
      return res.status(400).json({ message: "vote is not in progress" });
    }

    // 检查投票时间范围
    var now = Date.now();
    var startMs = vote.start_time ? new Date(vote.start_time).getTime() : NaN;
    var endMs = vote.end_time ? new Date(vote.end_time).getTime() : NaN;
    if (Number.isFinite(startMs) && now < startMs) {
      return res.status(400).json({ message: "voting has not started yet" });
    }
    if (Number.isFinite(endMs) && now > endMs) {
      return res.status(400).json({ message: "voting has ended" });
    }

    // 检查选择数量是否超过最大限制
    var maxChoices = parseInt(String(vote.max_choices ?? vote.maxChoices ?? ""), 10);
    if (Number.isFinite(maxChoices) && maxChoices > 0 && selected.length > maxChoices) {
      return res.status(400).json({ message: "too many selections" });
    }

    // 验证选项索引是否有效
    var optionsLen = (vote.options && vote.options.length) || 0;
    for (var i = 0; i < selected.length; i++) {
      var idx = selected[i];
      if (!Number.isFinite(idx) || idx < 0 || idx >= optionsLen) {
        return res.status(400).json({ message: "invalid option index" });
      }
    }

    // 检查是否已投票
    var voted = await voteRecordsService.hasVoted(vote_id, user_address);
    if (voted) {
      return res.status(400).json({ message: "you have already voted" });
    }

    // 创建投票记录（不存储 selected_options，因为该字段已从数据库删除）
    // 注意：选项数据已在上面验证过，确保了投票的有效性
    var created = await voteRecordsService.recordVote({
      vote_id: vote_id,
      user_address: user_address,
      tx_hash: tx_hash,
      block_number: block_number,
      block_timestamp: block_timestamp,
    });

    return res.status(201).json({ ok: true, record_id: created.record_id });
  } catch (e) {
    console.error("[vote_records] record error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 获取我的投票记录列表
// 获取我的投票记录列表
async function myList(req, res) {
  try {
    // 验证用户地址
    var user_address = req.query && req.query.user_address;
    if (!user_address || typeof user_address !== "string" || !ethers.isAddress(user_address)) {
      return res.status(400).json({ message: "invalid user_address" });
    }
    user_address = ethers.getAddress(user_address);

    // 查询投票记录列表
    var result = await voteRecordsService.listMyVoteRecords({
      user_address: user_address,
      page: req.query && req.query.page,
      pageSize: req.query && req.query.pageSize,
    });

    return res.json(result);
  } catch (e) {
    console.error("[vote_records] myList error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 检查是否已投票
async function votedStatus(req, res) {
  try {
    // 验证投票ID
    var vote_id = parseInt(String((req.query && req.query.vote_id) || ""), 10);
    if (!Number.isFinite(vote_id) || vote_id <= 0) {
      return res.status(400).json({ message: "invalid vote_id" });
    }

    // 验证用户地址
    var user_address = req.query && req.query.user_address;
    if (!user_address || typeof user_address !== "string" || !ethers.isAddress(user_address)) {
      return res.status(400).json({ message: "invalid user_address" });
    }
    user_address = ethers.getAddress(user_address);

    // 查询投票状态
    var voted = await voteRecordsService.hasVoted(vote_id, user_address);
    return res.json({ voted: !!voted });
  } catch (e) {
    console.error("[vote_records] votedStatus error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 获取投票记录详情
async function getDetail(req, res) {
  try {
    // 验证记录ID
    var record_id = parseInt(String((req.params && req.params.record_id) || ""), 10);
    if (!Number.isFinite(record_id) || record_id <= 0) {
      return res.status(400).json({ message: "invalid record_id" });
    }

    // 查询投票记录详情
    var detail = await voteRecordsService.getVoteRecordDetail(record_id);
    if (!detail) {
      return res.status(404).json({ message: "record not found" });
    }

    return res.json(detail);
  } catch (e) {
    console.error("[vote_records] getDetail error", e);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = {
  record,
  myList,
  votedStatus,
  getDetail,
};
