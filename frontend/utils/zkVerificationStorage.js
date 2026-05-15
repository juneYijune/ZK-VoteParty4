/**
 * ZK验证记录LocalStorage管理工具
 * 
 * 用于管理用户的零知识证明验证记录，存储在浏览器的localStorage中
 * 
 * 数据结构:
 * localStorage key: zk_verifications_{wallet_address}
 * value: {
 *   [vote_id]: {
 *     vote_id: number,
 *     wallet_address: string,
 *     vc_id: number,
 *     proof: object,
 *     publicSignals: array,
 *     is_verified: boolean,
 *     verified_at: string (ISO 8601)
 *   }
 * }
 */

/**
 * 生成localStorage的key
 * @param {string} walletAddress - 钱包地址
 * @returns {string} localStorage key
 */
function getStorageKey(walletAddress) {
  return `zk_verifications_${walletAddress}`;
}

/**
 * 安全地从localStorage读取数据
 * @param {string} key - localStorage key
 * @returns {object|null} 解析后的数据对象，失败时返回null
 */
function safeGetItem(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      return null;
    }
    return JSON.parse(item);
  } catch (error) {
    console.error('LocalStorage读取失败:', error);
    return null;
  }
}

/**
 * 安全地向localStorage写入数据
 * @param {string} key - localStorage key
 * @param {object} data - 要存储的数据对象
 * @returns {boolean} 是否成功
 */
function safeSetItem(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('LocalStorage写入失败:', error);
    return false;
  }
}

/**
 * 保存验证记录
 * @param {string} walletAddress - 钱包地址
 * @param {number} voteId - 投票ID
 * @param {object} data - 验证数据
 * @param {number} data.vote_id - 投票ID
 * @param {string} data.wallet_address - 钱包地址
 * @param {number} data.vc_id - VC ID
 * @param {object} data.proof - 零知识证明对象
 * @param {array} data.publicSignals - 公共信号数组
 * @param {boolean} data.is_verified - 是否验证通过
 * @param {string} data.verified_at - 验证时间 (ISO 8601格式)
 * @returns {boolean} 是否保存成功
 */
export function saveVerification(walletAddress, voteId, data) {
  try {
    if (!walletAddress || !voteId || !data) {
      console.error('saveVerification: 参数不完整');
      return false;
    }

    const key = getStorageKey(walletAddress);
    const allVerifications = safeGetItem(key) || {};
    
    // 保存验证记录
    allVerifications[voteId] = {
      ...data,
      vote_id: voteId,
      wallet_address: walletAddress
    };
    
    return safeSetItem(key, allVerifications);
  } catch (error) {
    console.error('saveVerification失败:', error);
    return false;
  }
}

/**
 * 获取单个验证记录
 * @param {string} walletAddress - 钱包地址
 * @param {number} voteId - 投票ID
 * @returns {object|null} 验证记录，不存在时返回null
 */
export function getVerification(walletAddress, voteId) {
  try {
    if (!walletAddress || !voteId) {
      return null;
    }

    const key = getStorageKey(walletAddress);
    const allVerifications = safeGetItem(key);
    
    if (!allVerifications) {
      return null;
    }
    
    return allVerifications[voteId] || null;
  } catch (error) {
    console.error('getVerification失败:', error);
    return null;
  }
}

/**
 * 获取用户所有验证记录
 * @param {string} walletAddress - 钱包地址
 * @returns {object} 所有验证记录的对象，key为vote_id
 */
export function getAllVerifications(walletAddress) {
  try {
    if (!walletAddress) {
      return {};
    }

    const key = getStorageKey(walletAddress);
    const allVerifications = safeGetItem(key);
    
    return allVerifications || {};
  } catch (error) {
    console.error('getAllVerifications失败:', error);
    return {};
  }
}

/**
 * 清除单个验证记录
 * @param {string} walletAddress - 钱包地址
 * @param {number} voteId - 投票ID
 * @returns {boolean} 是否清除成功
 */
export function clearVerification(walletAddress, voteId) {
  try {
    if (!walletAddress || !voteId) {
      return false;
    }

    const key = getStorageKey(walletAddress);
    const allVerifications = safeGetItem(key);
    
    if (!allVerifications) {
      return true; // 没有数据，视为清除成功
    }
    
    // 删除指定的验证记录
    delete allVerifications[voteId];
    
    return safeSetItem(key, allVerifications);
  } catch (error) {
    console.error('clearVerification失败:', error);
    return false;
  }
}

/**
 * 清除用户所有验证记录
 * @param {string} walletAddress - 钱包地址
 * @returns {boolean} 是否清除成功
 */
export function clearAllVerifications(walletAddress) {
  try {
    if (!walletAddress) {
      return false;
    }

    const key = getStorageKey(walletAddress);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('clearAllVerifications失败:', error);
    return false;
  }
}
