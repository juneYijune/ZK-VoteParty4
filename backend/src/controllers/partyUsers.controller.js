var { ethers } = require("ethers");
var partyUsersService = require("../services/partyUsers.service");

// 获取当前用户的党组织信息
async function getMyPartyOrg(req, res) {
  try {
    var walletAddress = req.query && req.query.wallet_address;
    if (!walletAddress || typeof walletAddress !== "string" || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ message: "invalid wallet_address" });
    }

    var info = await partyUsersService.getUserPartyOrg(ethers.getAddress(walletAddress));
    if (!info) {
      return res.json({ hasApplied: false });
    }

    return res.json({
      hasApplied: true,
      ...info,
    });
  } catch (e) {
    console.error("[partyUsers] getMyPartyOrg error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 计算钱包地址的 Poseidon Hash
async function hashWalletAddress(req, res) {
  try {
    var body = req.body || {};
    var wallet_address = body.wallet_address;
    
    if (!wallet_address || typeof wallet_address !== "string" || !ethers.isAddress(wallet_address)) {
      return res.status(400).json({ message: "invalid wallet_address" });
    }

    var hash = await partyUsersService.poseidonHashAddress(ethers.getAddress(wallet_address));
    
    return res.json({
      wallet_address: ethers.getAddress(wallet_address),
      wallet_address_hash: hash,
    });
  } catch (e) {
    console.error("[partyUsers] hashWalletAddress error", e);
    return res.status(500).json({ message: e.message || "server error" });
  }
}

// 申请加入党组织
async function applyToJoin(req, res) {
  try {
    var body = req.body || {};

    var user_name = body.user_name;
    if (!user_name || typeof user_name !== "string" || !user_name.trim()) {
      return res.status(400).json({ message: "invalid user_name" });
    }

    var id_number = body.id_number;
    if (!id_number || typeof id_number !== "string" || !id_number.trim()) {
      return res.status(400).json({ message: "invalid id_number" });
    }

    var wallet_address = body.wallet_address;
    if (!wallet_address || typeof wallet_address !== "string" || !ethers.isAddress(wallet_address)) {
      return res.status(400).json({ message: "invalid wallet_address" });
    }

    var party_org_id = parseInt(String(body.party_org_id || ""), 10);
    if (!Number.isFinite(party_org_id) || party_org_id <= 0) {
      return res.status(400).json({ message: "invalid party_org_id" });
    }

    // 检查是否已经申请过
    var existing = await partyUsersService.getUserByWalletAddress(ethers.getAddress(wallet_address));
    if (existing) {
      return res.status(409).json({ message: "already applied or joined" });
    }

    var payload = {
      user_name: user_name.trim(),
      id_number: id_number.trim(),
      wallet_address: ethers.getAddress(wallet_address),
      party_org_id: party_org_id,
    };

    var created = await partyUsersService.createPartyUserApplication(payload);
    return res.status(201).json({ ok: true, partyuser_id: created.partyuser_id });
  } catch (e) {
    console.error("[partyUsers] applyToJoin error", e);

    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ message: "wallet address already exists" });
    }

    return res.status(500).json({ message: "server error" });
  }
}

// 获取党组织的申请列表（党组织管理员使用）
async function listApplications(req, res) {
  try {
    var org_id = parseInt(String(req.query && req.query.org_id || ""), 10);
    if (!Number.isFinite(org_id) || org_id <= 0) {
      return res.status(400).json({ message: "invalid org_id" });
    }

    var result = await partyUsersService.listApplicationsByOrgId(org_id, {
      page: req.query && req.query.page,
      pageSize: req.query && req.query.pageSize,
    });

    return res.json(result);
  } catch (e) {
    console.error("[partyUsers] listApplications error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 审批申请
async function approveApplication(req, res) {
  try {
    var body = req.body || {};

    var partyuser_id = parseInt(String(body.partyuser_id || ""), 10);
    if (!Number.isFinite(partyuser_id) || partyuser_id <= 0) {
      return res.status(400).json({ message: "invalid partyuser_id" });
    }

    // 修复：确保 user_status 存在且有效
    if (body.user_status === undefined || body.user_status === null) {
      return res.status(400).json({ message: "user_status is required" });
    }

    var user_status = parseInt(String(body.user_status), 10);
    if (!Number.isFinite(user_status) || !(user_status === 0 || user_status === 1)) {
      return res.status(400).json({ message: "invalid user_status, must be 0 (reject) or 1 (approve)" });
    }

    var payload = {
      partyuser_id: partyuser_id,
      user_status: user_status,
    };

    var updated = await partyUsersService.approveApplication(payload);
    if (!updated) {
      return res.status(404).json({ message: "application not found or already processed" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[partyUsers] approveApplication error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 获取党组织的成员列表（党组织管理员使用）
async function listMembers(req, res) {
  try {
    var org_id = parseInt(String(req.query && req.query.org_id || ""), 10);
    if (!Number.isFinite(org_id) || org_id <= 0) {
      return res.status(400).json({ message: "invalid org_id" });
    }

    var result = await partyUsersService.listMembersByOrgId(org_id, {
      page: req.query && req.query.page,
      pageSize: req.query && req.query.pageSize,
    });

    return res.json(result);
  } catch (e) {
    console.error("[partyUsers] listMembers error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 迁出党组织（删除成员）
async function removeMember(req, res) {
  try {
    var body = req.body || {};

    var partyuser_id = parseInt(String(body.partyuser_id || ""), 10);
    if (!Number.isFinite(partyuser_id) || partyuser_id <= 0) {
      return res.status(400).json({ message: "invalid partyuser_id" });
    }

    var org_id = parseInt(String(body.org_id || ""), 10);
    if (!Number.isFinite(org_id) || org_id <= 0) {
      return res.status(400).json({ message: "invalid org_id" });
    }

    var deleted = await partyUsersService.removeMemberFromOrg(partyuser_id, org_id);
    if (!deleted) {
      return res.status(404).json({ message: "member not found or already removed" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[partyUsers] removeMember error", e);
    return res.status(500).json({ message: "server error" });
  }
}

module.exports = {
  getMyPartyOrg,
  hashWalletAddress,
  applyToJoin,
  listApplications,
  approveApplication,
  listMembers,
  removeMember,
};
