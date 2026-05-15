/**
 * ZK API错误代码定义
 * 
 * 统一的错误响应格式:
 * {
 *   success: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "用户友好的错误信息"
 *   }
 * }
 * 
 * 需求: 7.6
 */

var ZK_ERROR_CODES = {
  // 输入验证错误
  INVALID_INPUT: {
    code: "INVALID_INPUT",
    message: "输入数据无效"
  },
  
  // VC相关错误
  VC_NOT_FOUND: {
    code: "VC_NOT_FOUND",
    message: "身份凭证不存在或不属于该用户"
  },
  
  VC_REVOKED: {
    code: "VC_REVOKED",
    message: "身份凭证已被撤销或无效"
  },
  
  VC_SIGNATURE_INVALID: {
    code: "VC_SIGNATURE_INVALID",
    message: "身份凭证签名验证失败，请确认VC的有效性"
  },
  
  // 投票相关错误
  VOTE_NOT_FOUND: {
    code: "VOTE_NOT_FOUND",
    message: "投票不存在或已结束"
  },
  
  // 证明生成错误
  PROOF_GENERATION_FAILED: {
    code: "PROOF_GENERATION_FAILED",
    message: "证明生成失败，请重试或联系管理员"
  },
  
  // 证明验证错误
  PROOF_VERIFICATION_FAILED: {
    code: "PROOF_VERIFICATION_FAILED",
    message: "证明验证失败，请重试"
  },
  
  // 资格不符
  NOT_ELIGIBLE: {
    code: "NOT_ELIGIBLE",
    message: "您不满足该投票的资格要求"
  },
  
  // 网络错误
  NETWORK_ERROR: {
    code: "NETWORK_ERROR",
    message: "网络错误，请检查网络连接后重试"
  },
  
  // 存储错误
  STORAGE_ERROR: {
    code: "STORAGE_ERROR",
    message: "存储错误"
  }
};

/**
 * 创建错误响应对象
 * 
 * @param {string} errorCode - 错误代码
 * @param {string} customMessage - 自定义错误信息（可选）
 * @returns {object} 错误响应对象
 */
function createErrorResponse(errorCode, customMessage) {
  var errorDef = ZK_ERROR_CODES[errorCode];
  
  if (!errorDef) {
    errorDef = {
      code: "UNKNOWN_ERROR",
      message: "未知错误"
    };
  }
  
  return {
    success: false,
    error: {
      code: errorDef.code,
      message: customMessage || errorDef.message
    }
  };
}

module.exports = {
  ZK_ERROR_CODES,
  createErrorResponse
};
