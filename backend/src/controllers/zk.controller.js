/**
 * ZK零知识证明控制器
 * 处理证明生成和验证的API请求
 * 
 * 需求: 7.3, 7.4, 7.5, 7.6, 9.2
 */

var zkService = require("../services/zk.service");

/**
 * 生成零知识证明
 * POST /api/zk/generate-proof
 * 
 * 请求体:
 * {
 *   vc_id: number,
 *   vote_id: number,
 *   wallet_address: string
 * }
 * 
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     proof: object,
 *     publicSignals: array
 *   }
 * }
 * 
 * 需求: 7.3, 7.5
 */
async function generateProof(req, res) {
  try {
    var body = req.body || {};

    // 1. 验证请求参数
    var vc_id = parseInt(String(body.vc_id || ""), 10);
    if (!Number.isFinite(vc_id) || vc_id <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "无效的VC ID"
        }
      });
    }

    var vote_id = parseInt(String(body.vote_id || ""), 10);
    if (!Number.isFinite(vote_id) || vote_id <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "无效的投票ID"
        }
      });
    }

    var wallet_address = String(body.wallet_address || "").trim();
    if (!wallet_address || !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "无效的钱包地址"
        }
      });
    }

    // 2. 调用服务生成证明
    // 注意: 不记录私有输入到日志中（需求 9.2）
    console.log("[ZK Controller] 生成证明请求 - VC ID:", vc_id, "投票ID:", vote_id, "钱包地址:", wallet_address);
    
    var result = await zkService.generateProof(vc_id, vote_id, wallet_address);

    // 3. 返回成功响应
    return res.status(200).json({
      success: true,
      data: {
        proof: result.proof,
        publicSignals: result.publicSignals
      }
    });

  } catch (e) {
    console.error("[ZK Controller] 生成证明失败:", e.message);
    
    // 根据错误类型返回不同的错误代码
    var errorCode = "PROOF_GENERATION_FAILED";
    var statusCode = 500;
    
    if (e.message.includes("VC不存在") || e.message.includes("不属于该用户")) {
      errorCode = "VC_NOT_FOUND";
      statusCode = 404;
    } else if (e.message.includes("VC已被撤销") || e.message.includes("VC无效")) {
      errorCode = "VC_REVOKED";
      statusCode = 400;
    } else if (e.message.includes("投票不存在")) {
      errorCode = "VOTE_NOT_FOUND";
      statusCode = 404;
    } else if (e.message.includes("无效的")) {
      errorCode = "INVALID_INPUT";
      statusCode = 400;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: e.message || "证明生成失败，请重试或联系管理员"
      }
    });
  }
}

/**
 * 验证零知识证明
 * POST /api/zk/verify-proof
 * 
 * 请求体:
 * {
 *   proof: object,
 *   publicSignals: array,
 *   vote_id: number
 * }
 * 
 * 响应:
 * {
 *   success: true,
 *   data: {
 *     isValid: boolean,
 *     isEligible: boolean
 *   }
 * }
 * 
 * 需求: 7.4, 7.6
 */
async function verifyProof(req, res) {
  try {
    var body = req.body || {};

    // 1. 验证请求参数
    var proof = body.proof;
    if (!proof || typeof proof !== "object") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "无效的证明对象"
        }
      });
    }

    var publicSignals = body.publicSignals;
    if (!Array.isArray(publicSignals)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "无效的公共信号数组"
        }
      });
    }

    var vote_id = parseInt(String(body.vote_id || ""), 10);
    if (!Number.isFinite(vote_id) || vote_id <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "无效的投票ID"
        }
      });
    }

    // 2. 调用服务验证证明
    console.log("[ZK Controller] 验证证明请求 - 投票ID:", vote_id);
    
    var result = await zkService.verifyProof(proof, publicSignals, vote_id);

    // 3. 返回成功响应
    return res.status(200).json({
      success: true,
      data: {
        isValid: result.isValid,
        isEligible: result.isEligible
      }
    });

  } catch (e) {
    console.error("[ZK Controller] 验证证明失败:", e.message);
    
    // 根据错误类型返回不同的错误代码
    var errorCode = "PROOF_VERIFICATION_FAILED";
    var statusCode = 500;
    
    if (e.message.includes("无效的")) {
      errorCode = "INVALID_INPUT";
      statusCode = 400;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: e.message || "证明验证失败，请重试"
      }
    });
  }
}

module.exports = {
  generateProof,
  verifyProof
};
