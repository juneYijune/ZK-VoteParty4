/**
 * ZK零知识证明服务
 * 负责生成和验证零知识证明
 * 
 * 需求: 3.5, 3.6, 4.1, 4.2, 4.3
 */

var path = require('path');
var fs = require('fs');
var snarkjs = require('snarkjs');
var { query } = require('../lib/mysql');
var { mapVCToPrivateInputs, mapRuleToPublicInputs } = require('../utils/zkMapping');
var { poseidonHashAddress } = require('./partyUsers.service');

// ZK电路文件路径配置
var ZK_CIRCUITS_DIR = path.join(__dirname, '../../../ZKcircuits');
var WASM_FILE = path.join(ZK_CIRCUITS_DIR, 'build/eligibleVoter_js/eligibleVoter.wasm');
var ZKEY_FILE = path.join(ZK_CIRCUITS_DIR, 'build/eligibleVoter_final.zkey');
var VERIFICATION_KEY_FILE = path.join(ZK_CIRCUITS_DIR, 'keys/verification_key.json');

/**
 * 生成零知识证明
 * 
 * @param {number} vcId - VC ID
 * @param {number} voteId - 投票ID
 * @param {string} walletAddress - 用户钱包地址
 * @returns {Promise<{proof: object, publicSignals: array}>} 证明对象和公共信号
 * 
 * 需求: 3.5, 3.6
 */
async function generateProof(vcId, voteId, walletAddress) {
  try {
    // 1. 验证输入参数
    var vid = parseInt(String(vcId || ''), 10);
    var voteIdNum = parseInt(String(voteId || ''), 10);
    
    if (!Number.isFinite(vid) || vid <= 0) {
      throw new Error('无效的VC ID');
    }
    
    if (!Number.isFinite(voteIdNum) || voteIdNum <= 0) {
      throw new Error('无效的投票ID');
    }
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      throw new Error('无效的钱包地址');
    }

    // 2. 计算钱包地址的 Poseidon 哈希
    console.log('[ZK Service] 计算钱包地址哈希...');
    var walletHash = await poseidonHashAddress(walletAddress);
    console.log('[ZK Service] 钱包地址:', walletAddress, '-> 哈希:', walletHash);
    
    // 3. 获取VC内容
    var vcSql = 
      'SELECT vc_id, vc_content, vc_status, vc_holder_wallet_hash ' +
      'FROM verifiable_credentials ' +
      'WHERE vc_id = ? AND vc_holder_wallet_hash = ?';
    
    var vcRes = await query(vcSql, [vid, walletHash]);
    var vc = vcRes && vcRes[0] && vcRes[0][0];
    
    if (!vc) {
      throw new Error('VC不存在或不属于该用户');
    }
    
    if (vc.vc_status !== 1) {
      throw new Error('VC已被撤销或无效');
    }
    
    // 解析VC内容
    var vcContent = vc.vc_content;
    if (typeof vcContent === 'string') {
      try {
        vcContent = JSON.parse(vcContent);
      } catch (e) {
        throw new Error('VC内容格式错误');
      }
    }

    // 4. 获取投票资格规则
    var voteSql = 
      'SELECT vote_id, eligibility_rule ' +
      'FROM votes ' +
      'WHERE vote_id = ?';
    
    var voteRes = await query(voteSql, [voteIdNum]);
    var vote = voteRes && voteRes[0] && voteRes[0][0];
    
    if (!vote) {
      throw new Error('投票不存在');
    }
    
    // 解析资格规则
    var eligibilityRule = vote.eligibility_rule;
    if (typeof eligibilityRule === 'string') {
      try {
        eligibilityRule = JSON.parse(eligibilityRule);
      } catch (e) {
        throw new Error('资格规则格式错误');
      }
    }
    
    // 如果资格规则为null,使用默认值
    if (!eligibilityRule) {
      eligibilityRule = {
        require_formal_member: false,
        require_active_status: false,
        require_fee_paid: false,
        require_no_conflict: false,
        min_party_years: 0,
        require_org_code: null
      };
    }

    // 5. 映射VC内容为私有输入
    var privateInputs = mapVCToPrivateInputs(vcContent);
    
    // 6. 映射资格规则为公共输入
    var publicInputs = mapRuleToPublicInputs(eligibilityRule);

    // 7. 构造电路输入
    var circuitInputs = {
      // 私有输入
      is_formal_member: privateInputs.is_formal_member,
      is_active: privateInputs.is_active,
      fee_paid: privateInputs.fee_paid,
      no_conflict: privateInputs.no_conflict,
      voter_party_years: privateInputs.voter_party_years,
      voter_org_code: privateInputs.voter_org_code,
      
      // 公共输入
      require_formal_member: publicInputs.require_formal_member,
      require_active: publicInputs.require_active,
      require_fee_paid: publicInputs.require_fee_paid,
      require_no_conflict: publicInputs.require_no_conflict,
      require_party_years: publicInputs.require_party_years,
      min_party_years: publicInputs.min_party_years,
      require_org_code: publicInputs.require_org_code,
      required_org_code: publicInputs.required_org_code
    };

    // 8. 检查电路文件是否存在
    if (!fs.existsSync(WASM_FILE)) {
      throw new Error('电路WASM文件不存在: ' + WASM_FILE);
    }
    
    if (!fs.existsSync(ZKEY_FILE)) {
      throw new Error('电路ZKEY文件不存在: ' + ZKEY_FILE);
    }

    // 9. 生成零知识证明
    console.log('[ZK Service] 开始生成证明...');
    var startTime = Date.now();
    
    var { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      WASM_FILE,
      ZKEY_FILE
    );
    
    var endTime = Date.now();
    var duration = (endTime - startTime) / 1000;
    
    console.log('[ZK Service] 证明生成完成，耗时: ' + duration + '秒');
    
    // 10. 检查生成时间是否超过10秒
    if (duration > 10) {
      console.warn('[ZK Service] 警告: 证明生成时间超过10秒');
    }

    // 11. 返回证明和公共信号
    return {
      proof: proof,
      publicSignals: publicSignals
    };
    
  } catch (e) {
    console.error('[ZK Service] 生成证明失败:', e);
    throw new Error('证明生成失败: ' + e.message);
  }
}

/**
 * 验证零知识证明
 * 
 * @param {object} proof - 证明对象
 * @param {array} publicSignals - 公共信号数组
 * @param {number} voteId - 投票ID（用于日志记录）
 * @returns {Promise<{isValid: boolean, isEligible: boolean}>} 验证结果
 * 
 * 需求: 4.1, 4.2, 4.3
 */
async function verifyProof(proof, publicSignals, voteId) {
  try {
    // 1. 验证输入参数
    if (!proof || typeof proof !== 'object') {
      throw new Error('无效的证明对象');
    }
    
    if (!Array.isArray(publicSignals)) {
      throw new Error('无效的公共信号数组');
    }
    
    var voteIdNum = parseInt(String(voteId || ''), 10);
    if (!Number.isFinite(voteIdNum) || voteIdNum <= 0) {
      throw new Error('无效的投票ID');
    }

    // 2. 检查验证密钥文件是否存在
    if (!fs.existsSync(VERIFICATION_KEY_FILE)) {
      throw new Error('验证密钥文件不存在: ' + VERIFICATION_KEY_FILE);
    }

    // 3. 加载验证密钥
    console.log('[ZK Service] 加载验证密钥...');
    var vKeyContent = fs.readFileSync(VERIFICATION_KEY_FILE, 'utf8');
    var vKey = JSON.parse(vKeyContent);

    // 4. 验证证明
    console.log('[ZK Service] 开始验证证明...');
    var startTime = Date.now();
    
    var isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    var endTime = Date.now();
    var duration = (endTime - startTime) / 1000;
    
    console.log('[ZK Service] 证明验证完成，耗时: ' + duration + '秒，结果: ' + isValid);
    
    // 5. 检查验证时间是否超过2秒
    if (duration > 2) {
      console.warn('[ZK Service] 警告: 证明验证时间超过2秒');
    }

    // 6. 检查 publicSignals 中的 is_eligible 值
    // 根据电路设计，is_eligible 是第一个公共输出信号
    var isEligible = false;
    if (publicSignals.length > 0) {
      var isEligibleValue = publicSignals[0];
      // 将字符串转换为数字进行比较
      isEligible = (String(isEligibleValue) === '1');
    }

    // 7. 返回验证结果
    return {
      isValid: isValid,
      isEligible: isEligible
    };
    
  } catch (e) {
    console.error('[ZK Service] 验证证明失败:', e);
    throw new Error('证明验证失败: ' + e.message);
  }
}

module.exports = {
  generateProof,
  verifyProof
};
