var { ethers } = require("ethers");
var partyOrgsService = require("../services/partyOrgs.service");

// 获取党组织列表
async function list(req, res) {
  try {
    var result = await partyOrgsService.listPartyOrgs({
      keyword: req.query && req.query.keyword,
      status: req.query && req.query.status,
      page: req.query && req.query.page,
      pageSize: req.query && req.query.pageSize,
    });

    return res.json(result);
  } catch (e) {
    console.error("[party_orgs] list error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 撤销党组织管理员
// 撤销党组织管理员
async function revokeAdmin(req, res) {
  try {
    var body = req.body || {};

    // 验证管理员地址
    var orger_address = body.orger_address;
    if (!orger_address || typeof orger_address !== "string" || !ethers.isAddress(orger_address)) {
      return res.status(400).json({ message: "invalid orger_address" });
    }

    var payload = {
      orger_address: ethers.getAddress(orger_address),
      block_height: body.block_height || null,
      transaction_hash: body.transaction_hash || null,
    };

    // 验证区块高度
    if (payload.block_height !== null && payload.block_height !== undefined && payload.block_height !== "") {
      var bh = parseInt(String(payload.block_height), 10);
      if (!Number.isFinite(bh) || bh <= 0) {
        return res.status(400).json({ message: "invalid block_height" });
      }
      payload.block_height = bh;
    } else {
      payload.block_height = null;
    }

    // 验证交易哈希
    if (payload.transaction_hash !== null && payload.transaction_hash !== undefined && payload.transaction_hash !== "") {
      var th = String(payload.transaction_hash).trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(th)) {
        return res.status(400).json({ message: "invalid transaction_hash" });
      }
      payload.transaction_hash = th;
    } else {
      payload.transaction_hash = null;
    }

    var updated = await partyOrgsService.revokePartyOrgAdminByAddress(payload);
    if (!updated) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[party_orgs] revokeAdmin error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 更新党组织管理员地址
// 更新党组织管理员地址
async function updateAdmin(req, res) {
  try {
    var body = req.body || {};

    // 验证党组织ID
    var org_id = parseInt(String(body.org_id || ""), 10);
    if (!Number.isFinite(org_id) || org_id <= 0) {
      return res.status(400).json({ message: "invalid org_id" });
    }

    // 验证管理员地址
    var orger_address = body.orger_address;
    if (!orger_address || typeof orger_address !== "string" || !ethers.isAddress(orger_address)) {
      return res.status(400).json({ message: "invalid orger_address" });
    }

    var payload = {
      org_id: org_id,
      orger_address: ethers.getAddress(orger_address),
      block_height: body.block_height || null,
      transaction_hash: body.transaction_hash || null,
    };

    // 验证区块高度
    if (payload.block_height !== null && payload.block_height !== undefined && payload.block_height !== "") {
      var bh = parseInt(String(payload.block_height), 10);
      if (!Number.isFinite(bh) || bh <= 0) {
        return res.status(400).json({ message: "invalid block_height" });
      }
      payload.block_height = bh;
    } else {
      payload.block_height = null;
    }

    // 验证交易哈希
    if (payload.transaction_hash !== null && payload.transaction_hash !== undefined && payload.transaction_hash !== "") {
      var th = String(payload.transaction_hash).trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(th)) {
        return res.status(400).json({ message: "invalid transaction_hash" });
      }
      payload.transaction_hash = th;
    } else {
      payload.transaction_hash = null;
    }

    // 验证状态字段（可选，用于重启停用的党组织）
    if (body.status !== undefined && body.status !== null && body.status !== "") {
      var s = parseInt(String(body.status), 10);
      if (!(s === 0 || s === 1)) {
        return res.status(400).json({ message: "invalid status" });
      }
      payload.status = s;
    }

    // 此接口仅允许修改管理员地址、链上信息和状态
    if (
      body.org_name !== undefined ||
      body.org_code !== undefined ||
      body.org_type !== undefined ||
      body.leader_name !== undefined ||
      body.description !== undefined ||
      body.description_cid !== undefined
    ) {
      return res.status(400).json({ message: "only orger_address, status and chain fields allowed here" });
    }

    var updated = await partyOrgsService.updatePartyOrgAdminAddress(payload);
    if (!updated) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[party_orgs] updateAdmin error", e);

    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ message: "duplicate orger_address" });
    }

    return res.status(500).json({ message: "server error" });
  }
}

// 更新党组织链下信息
async function update(req, res) {
  try {
    var body = req.body || {};

    var org_id = parseInt(String(body.org_id || ""), 10);
    if (!Number.isFinite(org_id) || org_id <= 0) {
      return res.status(400).json({ message: "invalid org_id" });
    }

    var payload = {
      org_id: org_id,
      org_name: body.org_name,
      org_code: body.org_code,
      org_type: body.org_type,
      leader_name: body.leader_name,
      description: body.description,
      description_cid: body.description_cid,
      status: body.status,
    };

    if (payload.org_name !== undefined && payload.org_name !== null) {
      if (typeof payload.org_name !== "string" || !payload.org_name.trim()) {
        return res.status(400).json({ message: "invalid org_name" });
      }
      payload.org_name = payload.org_name.trim();
    }

    if (payload.org_code !== undefined && payload.org_code !== null) {
      if (typeof payload.org_code !== "string" || !payload.org_code.trim()) {
        return res.status(400).json({ message: "invalid org_code" });
      }
      payload.org_code = payload.org_code.trim();
    }

    if (payload.org_type !== undefined && payload.org_type !== null) {
      if (typeof payload.org_type !== "string") {
        return res.status(400).json({ message: "invalid org_type" });
      }
      payload.org_type = payload.org_type.trim();
    }

    if (payload.leader_name !== undefined && payload.leader_name !== null) {
      if (typeof payload.leader_name !== "string") {
        return res.status(400).json({ message: "invalid leader_name" });
      }
      payload.leader_name = payload.leader_name.trim();
    }

    if (payload.description !== undefined && payload.description !== null) {
      if (typeof payload.description !== "string") {
        return res.status(400).json({ message: "invalid description" });
      }
    }

    if (payload.description_cid !== undefined && payload.description_cid !== null) {
      if (typeof payload.description_cid !== "string") {
        return res.status(400).json({ message: "invalid description_cid" });
      }
      payload.description_cid = payload.description_cid.trim();
    }

    if (payload.status !== undefined && payload.status !== null && payload.status !== "") {
      var s = parseInt(String(payload.status), 10);
      if (!(s === 0 || s === 1)) {
        return res.status(400).json({ message: "invalid status" });
      }
      payload.status = s;
    } else {
      delete payload.status;
    }

    // do not allow changing on-chain admin address or chain metadata via this endpoint
    if (body.orger_address !== undefined || body.block_height !== undefined || body.transaction_hash !== undefined) {
      return res.status(400).json({ message: "orger_address/block_height/transaction_hash not allowed here" });
    }

    var updated = await partyOrgsService.updatePartyOrgOffchain(payload);
    if (!updated) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[party_orgs] update error", e);

    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ message: "duplicate org_code" });
    }

    return res.status(500).json({ message: "server error" });
  }
}

async function create(req, res) {
  try {
    var body = req.body || {};

    var org_name = body.org_name;
    var org_code = body.org_code;
    var orger_address = body.orger_address;

    if (!org_name || typeof org_name !== "string") {
      return res.status(400).json({ message: "invalid org_name" });
    }

    if (!org_code || typeof org_code !== "string") {
      return res.status(400).json({ message: "invalid org_code" });
    }

    if (!orger_address || typeof orger_address !== "string" || !ethers.isAddress(orger_address)) {
      return res.status(400).json({ message: "invalid orger_address" });
    }

    var payload = {
      org_name: org_name.trim(),
      org_code: org_code.trim(),
      org_type: body.org_type,
      leader_name: body.leader_name,
      orger_address: ethers.getAddress(orger_address),
      description: body.description,
      description_cid: body.description_cid,
      status: body.status === 0 ? 0 : 1,
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

    var created = await partyOrgsService.createPartyOrg(payload);
    return res.status(201).json({ ok: true, org_id: created.org_id });
  } catch (e) {
    console.error("[party_orgs] create error", e);

    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ message: "duplicate org_code or orger_address" });
    }

    return res.status(500).json({ message: "server error" });
  }
}

// 获取党组织详情
async function detail(req, res) {
  try {
    var orgIdRaw = req.params && req.params.org_id;
    var org_id = parseInt(String(orgIdRaw || ""), 10);
    if (!Number.isFinite(org_id) || org_id <= 0) {
      return res.status(400).json({ message: "invalid org_id" });
    }

    var row = await partyOrgsService.getPartyOrgById(org_id);
    if (!row) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json(row);
  } catch (e) {
    console.error("[party_orgs] detail error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 根据地址获取党组织详情
async function detailByAddress(req, res) {
  try {
    var address = req.params && req.params.address;
    if (!address || typeof address !== "string") {
      return res.status(400).json({ message: "invalid address" });
    }

    var row = await partyOrgsService.getPartyOrgByAddress(address);
    if (!row) {
      return res.status(404).json({ message: "not found" });
    }

    return res.json(row);
  } catch (e) {
    console.error("[party_orgs] detailByAddress error", e);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = {
  list,
  detail,
  detailByAddress,
  create,
  update,
  updateAdmin,
  revokeAdmin,
};
