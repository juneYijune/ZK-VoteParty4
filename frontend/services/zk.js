import { getFrontendEnv } from "@/lib/env";

/**
 * 获取后端基础URL
 * @returns {string} 后端基础URL
 * @throws {Error} 如果环境变量未配置
 */
function getBackendBaseUrl() {
  const { backendBaseUrl } = getFrontendEnv();
  if (!backendBaseUrl) throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL 未配置");
  return backendBaseUrl;
}

/**
 * 验证URL是否使用HTTPS协议
 * @param {string} url - 要验证的URL
 * @throws {Error} 如果URL不是HTTPS协议
 */
function ensureHttps(url) {
  if (!url.startsWith("https://") && !url.startsWith("http://localhost")) {
    throw new Error("必须使用HTTPS协议进行安全传输");
  }
}

/**
 * 转换证明格式为链上验证所需格式
 * @param {object} proof - snarkjs 生成的证明对象
 * @returns {object} 转换后的证明格式
 */
function formatProofForChain(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    c: [proof.pi_c[0], proof.pi_c[1]]
  };
}

/**
 * 生成零知识证明
 * @param {number} vcId - 可验证凭证ID
 * @param {number} voteId - 投票ID
 * @param {string} walletAddress - 钱包地址
 * @returns {Promise<{proof: object, publicSignals: array}>} 证明对象和公共信号
 * @throws {Error} 如果参数无效或API调用失败
 */
export async function generateProof(vcId, voteId, walletAddress) {
  // 参数验证
  if (!vcId || typeof vcId !== "number") {
    throw new Error("vcId 必须是有效的数字");
  }
  if (!voteId || typeof voteId !== "number") {
    throw new Error("voteId 必须是有效的数字");
  }
  if (!walletAddress || typeof walletAddress !== "string" || !walletAddress.trim()) {
    throw new Error("无效的钱包地址，请先连接钱包");
  }

  const base = getBackendBaseUrl();
  
  // 确保使用HTTPS协议
  ensureHttps(base);

  try {
    const res = await fetch(`${base}/api/zk/generate-proof`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        vc_id: vcId,
        vote_id: voteId,
        wallet_address: walletAddress
      }),
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      // 处理API错误响应 - 需求 11.2
      // 根据错误代码返回用户友好的错误信息
      const errorCode = data.error?.code;
      const errorMessage = data.error?.message || data.message;
      
      // 处理特定错误代码
      switch (errorCode) {
        case "VC_NOT_FOUND":
          throw new Error("您没有有效的可验证凭证，请先申请VC");
        case "VC_REVOKED":
          throw new Error("该可验证凭证已被撤销或无效");
        case "VC_SIGNATURE_INVALID":
          throw new Error("身份凭证签名验证失败，请确认VC的有效性");
        case "VOTE_NOT_FOUND":
          throw new Error("投票不存在或已结束");
        case "PROOF_GENERATION_FAILED":
          throw new Error("证明生成失败，请重试或联系管理员");
        default:
          throw new Error(errorMessage || "证明生成失败，请重试或联系管理员");
      }
    }

    // 验证返回数据结构
    if (!data.data || !data.data.proof || !data.data.publicSignals) {
      throw new Error("证明生成返回数据格式错误");
    }

    return data.data;
  } catch (error) {
    // 处理网络错误 - 需求 11.4
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error("网络错误，请检查网络连接后重试");
    }
    if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
      throw new Error("网络错误，请检查网络连接后重试");
    }
    // 返回用户友好的错误信息 - 需求 11.2
    throw error;
  }
}

/**
 * 验证零知识证明（链下）
 * @param {object} proof - 证明对象
 * @param {array} publicSignals - 公共信号数组
 * @param {number} voteId - 投票ID
 * @returns {Promise<{isValid: boolean, isEligible: boolean}>} 验证结果
 * @throws {Error} 如果参数无效或API调用失败
 */
export async function verifyProof(proof, publicSignals, voteId) {
  // 参数验证
  if (!proof || typeof proof !== "object") {
    throw new Error("proof 必须是有效的对象");
  }
  if (!Array.isArray(publicSignals)) {
    throw new Error("publicSignals 必须是数组");
  }
  if (!voteId || typeof voteId !== "number") {
    throw new Error("voteId 必须是有效的数字");
  }

  const base = getBackendBaseUrl();
  
  // 确保使用HTTPS协议
  ensureHttps(base);

  try {
    const res = await fetch(`${base}/api/zk/verify-proof`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        proof,
        publicSignals,
        vote_id: voteId
      }),
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      // 处理API错误响应 - 需求 11.3
      const errorCode = data.error?.code;
      const errorMessage = data.error?.message || data.message;
      
      // 处理特定错误代码
      switch (errorCode) {
        case "NOT_ELIGIBLE":
          throw new Error("您不满足该投票的资格要求");
        case "PROOF_VERIFICATION_FAILED":
          throw new Error("证明验证失败，请重试");
        case "VOTE_NOT_FOUND":
          throw new Error("投票不存在或已结束");
        default:
          // 如果返回数据中明确标识不符合资格
          if (data.data?.isEligible === false) {
            throw new Error("您不满足该投票的资格要求");
          }
          throw new Error(errorMessage || "证明验证失败，请重试");
      }
    }

    // 验证返回数据结构
    if (!data.data || typeof data.data.isValid !== "boolean") {
      throw new Error("证明验证返回数据格式错误");
    }

    return data.data;
  } catch (error) {
    // 处理网络错误 - 需求 11.4
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error("网络错误，请检查网络连接后重试");
    }
    if (error.message.includes("NetworkError") || error.message.includes("Failed to fetch")) {
      throw new Error("网络错误，请检查网络连接后重试");
    }
    // 返回用户友好的错误信息 - 需求 11.3
    throw error;
  }
}

/**
 * 验证零知识证明（链上）
 * @param {object} proof - 证明对象
 * @param {array} publicSignals - 公共信号数组（9个信号）
 * @param {number} voteId - 投票ID
 * @param {string} walletAddress - 钱包地址
 * @returns {Promise<{isValid: boolean, isEligible: boolean, txHash: string}>} 验证结果
 * @throws {Error} 如果参数无效或交易失败
 */
export async function verifyProofOnChain(proof, publicSignals, voteId, walletAddress) {
  // 参数验证
  if (!proof || typeof proof !== "object") {
    throw new Error("proof 必须是有效的对象");
  }
  if (!Array.isArray(publicSignals)) {
    throw new Error("publicSignals 必须是数组");
  }
  if (publicSignals.length !== 9) {
    throw new Error(`publicSignals 必须包含 9 个信号，当前有 ${publicSignals.length} 个`);
  }
  if (!voteId || typeof voteId !== "number") {
    throw new Error("voteId 必须是有效的数字");
  }
  if (!walletAddress || typeof walletAddress !== "string" || !walletAddress.trim()) {
    throw new Error("无效的钱包地址，请先连接钱包");
  }

  try {
    // 检查是否安装了 MetaMask
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("请先安装 MetaMask 钱包");
    }

    // 动态导入 ethers
    const { ethers } = await import("ethers");
    
    // 导入合约配置
    const { VotingEligibilityVerifierContract } = await import("@/contracts/votingEligibilityVerifier");
    
    if (!VotingEligibilityVerifierContract.address) {
      throw new Error("验证器合约地址未配置，请联系管理员");
    }

    // 连接到 MetaMask
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // 创建合约实例
    const contract = new ethers.Contract(
      VotingEligibilityVerifierContract.address,
      VotingEligibilityVerifierContract.abi,
      signer
    );

    // 转换证明格式
    const formattedProof = formatProofForChain(proof);
    
    // 调用合约验证方法
    // publicSignals 包含 9 个信号：
    // [0]: is_eligible (输出) ⚠️ 注意：输出在第一个位置！
    // [1-8]: 8个公共输入（资格规则）
    console.log("正在发送链上验证交易...");
    console.log("公共信号:", publicSignals);
    console.log("is_eligible (publicSignals[0]):", publicSignals[0]);
    
    const tx = await contract.verifyProof(
      formattedProof.a,
      formattedProof.b,
      formattedProof.c,
      publicSignals, // 传递完整的 9 个信号
      voteId
    );

    console.log("等待交易确认...", tx.hash);
    const receipt = await tx.wait();
    
    console.log("交易已确认:", receipt);

    // 获取区块信息以获取时间戳
    const block = await provider.getBlock(receipt.blockNumber);
    const timestamp = block ? block.timestamp : null;

    // 从交易回执中获取验证结果
    // 查找 ProofVerified 事件
    const event = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed && parsed.name === "ProofVerified";
      } catch {
        return false;
      }
    });

    let isValid = false;
    if (event) {
      const parsed = contract.interface.parseLog(event);
      isValid = parsed.args.isValid;
    }

    // 链上验证成功，isEligible 从 publicSignals[0] 获取（输出在第一个位置）
    const isEligible = publicSignals[0] === "1";

    return {
      isValid: isValid,
      isEligible: isEligible && isValid,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: timestamp
    };

  } catch (error) {
    console.error("链上验证失败:", error);
    
    // 处理特定错误
    if (error.code === "ACTION_REJECTED" || error.code === 4001) {
      throw new Error("用户取消了交易");
    }
    if (error.message.includes("insufficient funds")) {
      throw new Error("账户余额不足，无法支付 Gas 费用");
    }
    if (error.message.includes("Verifier contract not set")) {
      throw new Error("验证器合约未配置，请联系管理员");
    }
    if (error.message.includes("Proof already verified")) {
      throw new Error("该证明已经验证过，无法重复验证");
    }
    
    throw new Error(error.message || "链上验证失败，请重试");
  }
}
