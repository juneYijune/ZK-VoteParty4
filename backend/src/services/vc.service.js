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

// 计算 VC Hash: Poseidon(vc_content + holder_wallet_hash)
async function calculateVCHash(vcContent, holderWalletHash) {
  try {
    var poseidon = await initPoseidon();
    
    // 将 VC 内容转换为数字数组
    var contentValues = [
      vcContent.isFormalPartyMember ? 1 : 0,
      vcContent.partyYears || 0,
      // 将 partyOrgCode 转换为数字（取前10位数字）
      parseInt(String(vcContent.partyOrgCode || "0").replace(/\D/g, '').slice(0, 10) || "0", 10),
      vcContent.partyStatus || 0,
      vcContent.paidPartyFee ? 1 : 0,
      vcContent.conflictFree ? 1 : 0,
    ];
    
    // 将 wallet_hash 转换为 BigInt（去掉 0x 前缀）
    var walletHashHex = String(holderWalletHash || "").trim();
    if (walletHashHex.startsWith("0x")) {
      walletHashHex = walletHashHex.slice(2);
    }
    
    // 取前32字节（64个十六进制字符）
    walletHashHex = walletHashHex.slice(0, 64).padStart(64, "0");
    var walletHashBigInt = BigInt("0x" + walletHashHex);
    
    // 合并所有值
    var allValues = contentValues.map(v => BigInt(v));
    allValues.push(walletHashBigInt);
    
    // 使用 Poseidon hash
    var hash = poseidon(allValues);
    
    // 转换为十六进制字符串
    var hashHex = poseidon.F.toString(hash, 16);
    
    // 补齐到64位（32字节）
    return "0x" + hashHex.padStart(64, "0");
  } catch (e) {
    console.error("计算 VC Hash 失败:", e);
    throw new Error("计算 VC Hash 失败: " + e.message);
  }
}

// 颁发 VC
async function issueVC(payload) {
  var pool = getMysqlPool();
  var conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 计算 VC Hash
    var vcHash = await calculateVCHash(payload.vc_content, payload.vc_holder_wallet_hash);

    var sql =
      "INSERT INTO verifiable_credentials " +
      "(vc_issuer_org_id, vc_issuer_address, vc_holder_user_id, vc_holder_wallet_hash, " +
      "vc_type, vc_hash, vc_content, vc_signature_type, vc_signature_value, vc_status) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    var values = [
      payload.vc_issuer_org_id,
      payload.vc_issuer_address,
      payload.vc_holder_user_id,
      payload.vc_holder_wallet_hash,
      payload.vc_type || "PARTY_MEMBER",
      vcHash,
      JSON.stringify(payload.vc_content),
      payload.vc_signature_type || "ECDSA",
      payload.vc_signature_value,
      payload.vc_status !== undefined ? payload.vc_status : 1, // 使用传入的状态，默认为有效
    ];

    var res = await conn.query(sql, values);
    var insertId = res && res[0] && res[0].insertId;

    await conn.commit();
    return { vc_id: insertId, vc_hash: vcHash };
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

// 查询用户的 VC 列表
async function listVCsByUser(params) {
  var holder_user_id = params.holder_user_id;
  var holder_wallet_hash = params.holder_wallet_hash;
  var vc_type = params.vc_type;
  var vc_status = params.vc_status;

  var page = parseInt(params.page || "1", 10);
  var pageSize = parseInt(params.pageSize || "10", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) pageSize = 10;

  var where = [];
  var values = [];

  if (holder_user_id !== undefined && holder_user_id !== null && holder_user_id !== "") {
    var uid = parseInt(String(holder_user_id), 10);
    if (Number.isFinite(uid) && uid > 0) {
      where.push("vc_holder_user_id = ?");
      values.push(uid);
    }
  }

  if (holder_wallet_hash) {
    where.push("vc_holder_wallet_hash = ?");
    values.push(holder_wallet_hash);
  }

  if (vc_type) {
    where.push("vc_type = ?");
    values.push(vc_type);
  }

  if (vc_status !== undefined && vc_status !== null && vc_status !== "") {
    var s = parseInt(String(vc_status), 10);
    if (Number.isFinite(s)) {
      where.push("vc_status = ?");
      values.push(s);
    }
  }

  var whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  var countSql = "SELECT COUNT(1) AS total FROM verifiable_credentials " + whereSql;
  var countRes = await query(countSql, values);
  var total = (countRes && countRes[0] && countRes[0][0] && countRes[0][0].total) || 0;

  var offset = (page - 1) * pageSize;
  var listSql =
    "SELECT vc_id, vc_issuer_org_id, vc_issuer_address, vc_holder_user_id, vc_holder_wallet_hash, " +
    "vc_type, vc_hash, vc_content, vc_signature_type, vc_signature_value, vc_status, " +
    "vc_issued_at, vc_revoked_at " +
    "FROM verifiable_credentials " +
    (whereSql ? whereSql + " " : "") +
    "ORDER BY vc_issued_at DESC LIMIT ? OFFSET ?";

  var listValues = values.slice();
  listValues.push(pageSize, offset);

  var listRes = await query(listSql, listValues);
  var items = (listRes && listRes[0]) || [];

  // 解析 vc_content JSON
  for (var i = 0; i < items.length; i++) {
    if (items[i].vc_content && typeof items[i].vc_content === 'string') {
      try {
        items[i].vc_content = JSON.parse(items[i].vc_content);
      } catch (e) {
        items[i].vc_content = null;
      }
    }
  }

  return {
    items: items,
    total: total,
    page: page,
    pageSize: pageSize,
  };
}

// 撤销 VC
async function revokeVC(vc_id) {
  var vid = parseInt(String(vc_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) {
    throw new Error("invalid vc_id");
  }

  var sql = "UPDATE verifiable_credentials SET vc_status = 0, vc_revoked_at = NOW() WHERE vc_id = ?";
  var res = await query(sql, [vid]);
  var affected = res && res[0] && res[0].affectedRows;
  return affected > 0;
}

// 获取 VC 详情
async function getVCById(vc_id) {
  var vid = parseInt(String(vc_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) return null;

  var sql =
    "SELECT vc_id, vc_issuer_org_id, vc_issuer_address, vc_holder_user_id, vc_holder_wallet_hash, " +
    "vc_type, vc_hash, vc_content, vc_signature_type, vc_signature_value, vc_status, " +
    "vc_issued_at, vc_revoked_at " +
    "FROM verifiable_credentials WHERE vc_id = ?";

  var res = await query(sql, [vid]);
  var vc = (res && res[0] && res[0][0]) || null;
  if (!vc) return null;

  // 解析 vc_content JSON
  if (vc.vc_content && typeof vc.vc_content === 'string') {
    try {
      vc.vc_content = JSON.parse(vc.vc_content);
    } catch (e) {
      vc.vc_content = null;
    }
  }

  return vc;
}

// 更新 VC
async function updateVC(vc_id, payload) {
  var vid = parseInt(String(vc_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) {
    throw new Error("invalid vc_id");
  }

  var pool = getMysqlPool();
  var conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 先获取原 VC 信息
    var selectSql = "SELECT vc_id, vc_holder_wallet_hash, vc_status, vc_content FROM verifiable_credentials WHERE vc_id = ?";
    var selectRes = await conn.query(selectSql, [vid]);
    var existingVC = selectRes && selectRes[0] && selectRes[0][0];
    
    if (!existingVC) {
      throw new Error("VC not found");
    }

    // 计算新的 VC Hash
    var vcHash = await calculateVCHash(payload.vc_content, existingVC.vc_holder_wallet_hash);

    var vcStatusValue = payload.vc_status !== undefined ? payload.vc_status : 1;
    var vcContentString = JSON.stringify(payload.vc_content);

    // 如果状态从有效变为撤销，设置 vc_revoked_at
    var sql;
    var values;
    
    if (vcStatusValue === 0 && existingVC.vc_status !== 0) {
      // 撤销 VC，设置 vc_revoked_at
      sql =
        "UPDATE verifiable_credentials SET " +
        "vc_content = ?, vc_hash = ?, vc_signature_value = ?, vc_status = ?, vc_revoked_at = NOW() " +
        "WHERE vc_id = ?";
      values = [
        vcContentString,
        vcHash,
        payload.vc_signature_value,
        vcStatusValue,
        vid,
      ];
    } else {
      // 正常更新
      sql =
        "UPDATE verifiable_credentials SET " +
        "vc_content = ?, vc_hash = ?, vc_signature_value = ?, vc_status = ? " +
        "WHERE vc_id = ?";
      values = [
        vcContentString,
        vcHash,
        payload.vc_signature_value,
        vcStatusValue,
        vid,
      ];
    }

    var res = await conn.query(sql, values);
    var affected = res && res[0] && res[0].affectedRows;

    await conn.commit();
    
    return { success: affected > 0, vc_hash: vcHash };
  } catch (e) {
    console.error("[updateVC] 更新失败:", e);
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

// 验证 VC 签名
async function verifyVCSignature(vc_id) {
  var vid = parseInt(String(vc_id || ""), 10);
  if (!Number.isFinite(vid) || vid <= 0) {
    throw new Error("invalid vc_id");
  }

  // 获取 VC 详情
  var vc = await getVCById(vid);
  if (!vc) {
    throw new Error("VC not found");
  }

  var ethers = require("ethers");

  try {
    // 规范化地址格式
    var issuerAddress = vc.vc_issuer_address;
    var holderWalletHash = vc.vc_holder_wallet_hash;

    // 确保 vc_content 的属性顺序一致 - 按字母顺序排序
    var sortedVcContent = {
      conflictFree: vc.vc_content.conflictFree,
      isFormalPartyMember: vc.vc_content.isFormalPartyMember,
      partyOrgCode: vc.vc_content.partyOrgCode,
      partyStatus: vc.vc_content.partyStatus,
      partyYears: vc.vc_content.partyYears,
      paidPartyFee: vc.vc_content.paidPartyFee,
    };

    // 1. 重建签名数据 - 必须与签名时的顺序和格式完全一致
    var signatureData = {
      vc_content: sortedVcContent,
      vc_issuer_address: issuerAddress,
      vc_holder_wallet_hash: holderWalletHash,
      vc_status: vc.vc_status,
    };
    var signatureDataString = JSON.stringify(signatureData);

    // 2. 验证签名
    var recoveredAddress = ethers.verifyMessage(signatureDataString, vc.vc_signature_value);
    var isSignatureValid = recoveredAddress.toLowerCase() === issuerAddress.toLowerCase();

    // 3. 检查签发者是否是合法的党组织管理员
    var checkOrgSql = 
      "SELECT org_id, org_name, org_code, status " +
      "FROM party_orgs " +
      "WHERE orger_address = ? AND status = 1";
    var orgRes = await query(checkOrgSql, [vc.vc_issuer_address]);
    var issuerOrg = orgRes && orgRes[0] && orgRes[0][0];
    var isLegalIssuer = !!issuerOrg;

    // 4. 检查 VC 是否有效（未撤销）
    var isVCActive = vc.vc_status === 1;

    // 5. 返回验证结果
    return {
      isValid: isSignatureValid && isLegalIssuer && isVCActive,
      isSignatureValid: isSignatureValid,
      isLegalIssuer: isLegalIssuer,
      isVCActive: isVCActive,
      details: {
        vc_id: vc.vc_id,
        vc_type: vc.vc_type,
        vc_issuer_address: vc.vc_issuer_address,
        recovered_address: recoveredAddress,
        issuer_org: issuerOrg ? {
          org_id: issuerOrg.org_id,
          org_name: issuerOrg.org_name,
          org_code: issuerOrg.org_code,
        } : null,
        vc_status: vc.vc_status,
        vc_issued_at: vc.vc_issued_at,
        vc_revoked_at: vc.vc_revoked_at,
      },
    };
  } catch (e) {
    console.error("[verifyVCSignature] 验证失败:", e);
    throw new Error("签名验证失败: " + e.message);
  }
}

module.exports = {
  issueVC,
  listVCsByUser,
  revokeVC,
  getVCById,
  updateVC,
  calculateVCHash,
  verifyVCSignature,
};
