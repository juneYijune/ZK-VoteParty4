var vcService = require("../services/vc.service");
 var partyUsersService = require("../services/partyUsers.service");
// 颁发 VC
async function issue(req, res) {
  try {
    var body = req.body || {};

    // 验证必填字段
    var vc_issuer_org_id = parseInt(String(body.vc_issuer_org_id || ""), 10);
    if (!Number.isFinite(vc_issuer_org_id) || vc_issuer_org_id <= 0) {
      return res.status(400).json({ message: "invalid vc_issuer_org_id" });
    }

    var vc_issuer_address = String(body.vc_issuer_address || "").trim();
    if (!vc_issuer_address || !/^0x[0-9a-fA-F]{40}$/.test(vc_issuer_address)) {
      return res.status(400).json({ message: "invalid vc_issuer_address" });
    }

    var vc_holder_user_id = parseInt(String(body.vc_holder_user_id || ""), 10);
    if (!Number.isFinite(vc_holder_user_id) || vc_holder_user_id <= 0) {
      return res.status(400).json({ message: "invalid vc_holder_user_id" });
    }

    var vc_holder_wallet_hash = String(body.vc_holder_wallet_hash || "").trim();
    if (!vc_holder_wallet_hash || !/^0x[0-9a-fA-F]{64}$/.test(vc_holder_wallet_hash)) {
      return res.status(400).json({ message: "invalid vc_holder_wallet_hash" });
    }

    var vc_content = body.vc_content;
    if (!vc_content || typeof vc_content !== "object") {
      return res.status(400).json({ message: "invalid vc_content" });
    }

    // 验证 vc_content 的必填字段
    if (typeof vc_content.isFormalPartyMember !== "boolean") {
      return res.status(400).json({ message: "vc_content.isFormalPartyMember is required" });
    }
    if (typeof vc_content.partyYears !== "number" || vc_content.partyYears < 0) {
      return res.status(400).json({ message: "vc_content.partyYears must be a non-negative number" });
    }
    if (!vc_content.partyOrgCode || typeof vc_content.partyOrgCode !== "string") {
      return res.status(400).json({ message: "vc_content.partyOrgCode is required" });
    }
    if (typeof vc_content.partyStatus !== "number") {
      return res.status(400).json({ message: "vc_content.partyStatus is required" });
    }
    if (typeof vc_content.paidPartyFee !== "boolean") {
      return res.status(400).json({ message: "vc_content.paidPartyFee is required" });
    }
    if (typeof vc_content.conflictFree !== "boolean") {
      return res.status(400).json({ message: "vc_content.conflictFree is required" });
    }

    var vc_signature_value = String(body.vc_signature_value || "").trim();
    if (!vc_signature_value) {
      return res.status(400).json({ message: "invalid vc_signature_value" });
    }

    // 验证 vc_status（可选，默认为 1）
    var vc_status = 1;
    if (body.vc_status !== undefined && body.vc_status !== null && body.vc_status !== "") {
      vc_status = parseInt(String(body.vc_status), 10);
      if (!Number.isFinite(vc_status) || (vc_status !== 0 && vc_status !== 1)) {
        return res.status(400).json({ message: "vc_status must be 0 or 1" });
      }
    }

    var payload = {
      vc_issuer_org_id: vc_issuer_org_id,
      vc_issuer_address: vc_issuer_address,
      vc_holder_user_id: vc_holder_user_id,
      vc_holder_wallet_hash: vc_holder_wallet_hash,
      vc_type: body.vc_type || "PARTY_MEMBER",
      vc_content: vc_content,
      vc_signature_type: body.vc_signature_type || "ECDSA",
      vc_signature_value: vc_signature_value,
      vc_status: vc_status,
    };

    var result = await vcService.issueVC(payload);
    return res.status(201).json({
      ok: true,
      vc_id: result.vc_id,
      vc_hash: result.vc_hash,
    });
  } catch (e) {
    console.error("[vc] issue error", e);
    return res.status(500).json({ message: e.message || "server error" });
  }
}

// 查询 VC 列表
async function list(req, res) {
  try {
    var result = await vcService.listVCsByUser({
      holder_user_id: req.query && req.query.holder_user_id,
      holder_wallet_hash: req.query && req.query.holder_wallet_hash,
      vc_type: req.query && req.query.vc_type,
      vc_status: req.query && req.query.vc_status,
      page: req.query && req.query.page,
      pageSize: req.query && req.query.pageSize,
    });

    return res.json(result);
  } catch (e) {
    console.error("[vc] list error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 撤销 VC
async function revoke(req, res) {
  try {
    var vc_id = req.params && req.params.vc_id;
    var vid = parseInt(String(vc_id || ""), 10);
    if (!Number.isFinite(vid) || vid <= 0) {
      return res.status(400).json({ message: "invalid vc_id" });
    }

    var success = await vcService.revokeVC(vid);
    if (!success) {
      return res.status(404).json({ message: "VC not found" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[vc] revoke error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 获取 VC 详情
async function detail(req, res) {
  try {
    var vc_id = req.params && req.params.vc_id;
    var vid = parseInt(String(vc_id || ""), 10);
    if (!Number.isFinite(vid) || vid <= 0) {
      return res.status(400).json({ message: "invalid vc_id" });
    }

    var vc = await vcService.getVCById(vid);
    if (!vc) {
      return res.status(404).json({ message: "VC not found" });
    }

    return res.json(vc);
  } catch (e) {
    console.error("[vc] detail error", e);
    return res.status(500).json({ message: "server error" });
  }
}

// 更新 VC
async function update(req, res) {
  try {
    var vc_id = req.params && req.params.vc_id;
    var vid = parseInt(String(vc_id || ""), 10);
    if (!Number.isFinite(vid) || vid <= 0) {
      return res.status(400).json({ message: "invalid vc_id" });
    }

    var body = req.body || {};

    var vc_content = body.vc_content;
    if (!vc_content || typeof vc_content !== "object") {
      return res.status(400).json({ message: "invalid vc_content" });
    }

    // 验证 vc_content 的必填字段
    if (typeof vc_content.isFormalPartyMember !== "boolean") {
      return res.status(400).json({ message: "vc_content.isFormalPartyMember is required" });
    }
    if (typeof vc_content.partyYears !== "number" || vc_content.partyYears < 0) {
      return res.status(400).json({ message: "vc_content.partyYears must be a non-negative number" });
    }
    if (!vc_content.partyOrgCode || typeof vc_content.partyOrgCode !== "string") {
      return res.status(400).json({ message: "vc_content.partyOrgCode is required" });
    }
    if (typeof vc_content.partyStatus !== "number") {
      return res.status(400).json({ message: "vc_content.partyStatus is required" });
    }
    if (typeof vc_content.paidPartyFee !== "boolean") {
      return res.status(400).json({ message: "vc_content.paidPartyFee is required" });
    }
    if (typeof vc_content.conflictFree !== "boolean") {
      return res.status(400).json({ message: "vc_content.conflictFree is required" });
    }

    var vc_signature_value = String(body.vc_signature_value || "").trim();
    if (!vc_signature_value) {
      return res.status(400).json({ message: "invalid vc_signature_value" });
    }

    // 验证 vc_status（可选，默认为 1）
    var vc_status = 1;
    if (body.vc_status !== undefined && body.vc_status !== null && body.vc_status !== "") {
      vc_status = parseInt(String(body.vc_status), 10);
      if (!Number.isFinite(vc_status) || (vc_status !== 0 && vc_status !== 1)) {
        return res.status(400).json({ message: "vc_status must be 0 or 1" });
      }
    }

    var payload = {
      vc_content: vc_content,
      vc_signature_value: vc_signature_value,
      vc_status: vc_status,
    };

    var result = await vcService.updateVC(vid, payload);
    if (!result.success) {
      return res.status(404).json({ message: "VC not found" });
    }

    return res.json({
      ok: true,
      vc_id: vid,
      vc_hash: result.vc_hash,
    });
  } catch (e) {
    console.error("[vc] update error", e);
    return res.status(500).json({ message: e.message || "server error" });
  }
}

// 验证 VC 签名
async function verifySignature(req, res) {
  try {
    var vc_id = req.params && req.params.vc_id;
    var vid = parseInt(String(vc_id || ""), 10);
    if (!Number.isFinite(vid) || vid <= 0) {
      return res.status(400).json({ message: "invalid vc_id" });
    }

    var result = await vcService.verifyVCSignature(vid);
    
    return res.json({
      ok: true,
      vc_id: vid,
      isValid: result.isValid,
      isSignatureValid: result.isSignatureValid,
      isLegalIssuer: result.isLegalIssuer,
      isVCActive: result.isVCActive,
      details: result.details,
    });
  } catch (e) {
    console.error("[vc] verifySignature error", e);
    return res.status(500).json({ message: e.message || "server error" });
  }
}

// 获取用户的有效VC列表
async function getMyValidVCs(req, res) {
  try {
    // 从请求头获取 wallet_address
    var walletAddress = req.headers["x-wallet-address"];
    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ 
        success: false,
        message: "wallet_address is required in headers" 
      });
    }

    // 验证 wallet_address 格式（以太坊地址格式）
    if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ 
        success: false,
        message: "invalid wallet_address format" 
      });
    }

    // 使用 Poseidon 哈希计算 wallet_hash
   
    var walletHash = await partyUsersService.poseidonHashAddress(walletAddress);

    // 获取用户的有效VC列表（vc_status=1）
    var result = await vcService.listVCsByUser({
      holder_wallet_hash: walletHash,
      vc_status: 1,  // 只获取有效的VC
      page: 1,
      pageSize: 100,  // 获取所有有效VC
    });

    return res.json({
      success: true,
      data: result.items,
    });
  } catch (e) {
    console.error("[vc] getMyValidVCs error", e);
    return res.status(500).json({ 
      success: false,
      message: e.message || "server error" 
    });
  }
}

module.exports = {
  issue,
  list,
  revoke,
  detail,
  update,
  verifySignature,
  getMyValidVCs,
};
