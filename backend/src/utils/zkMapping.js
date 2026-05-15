/**
 * ZK映射工具函数
 * 用于将VC内容和资格规则映射为零知识证明电路的输入
 */

/**
 * 将VC内容映射为电路私有输入
 * 
 * @param {Object} vcContent - VC内容对象
 * @param {boolean} vcContent.isFormalPartyMember - 是否正式党员
 * @param {number} vcContent.partyStatus - 党员状态，1=active
 * @param {boolean} vcContent.paidPartyFee - 是否缴纳党费
 * @param {boolean} vcContent.conflictFree - 无冲突
 * @param {number} vcContent.partyYears - 党龄（年）
 * @param {string} vcContent.partyOrgCode - 党组织编码，如"ORG001"
 * @returns {Object} 电路私有输入对象
 * 
 * 需求: 3.1, 3.2, 12.1, 12.2, 12.3, 12.4
 */
function mapVCToPrivateInputs(vcContent) {
  if (!vcContent) {
    throw new Error('vcContent is required');
  }

  return {
    // 布尔值转换：true -> 1, false -> 0
    is_formal_member: vcContent.isFormalPartyMember ? 1 : 0,
    
    // partyStatus判断：值为1视为active（转换为1），其他值视为inactive（转换为0）
    is_active: vcContent.partyStatus === 1 ? 1 : 0,
    
    // 布尔值转换：true -> 1, false -> 0
    fee_paid: vcContent.paidPartyFee ? 1 : 0,
    
    // 布尔值转换：true -> 1, false -> 0
    no_conflict: vcContent.conflictFree ? 1 : 0,
    
    // 党龄直接使用数值
    voter_party_years: vcContent.partyYears,
    
    // partyOrgCode数字提取：移除所有非数字字符后转换为整数
    // 例如："ORG001" -> 1, "ORG123" -> 123, "ABC" -> 0
    voter_org_code: parseInt(vcContent.partyOrgCode.replace(/\D/g, '')) || 0
  };
}

/**
 * 将资格规则映射为电路公共输入
 * 
 * @param {Object} eligibilityRule - 资格规则对象
 * @param {boolean} eligibilityRule.require_formal_member - 是否要求正式党员
 * @param {boolean} eligibilityRule.require_active_status - 是否要求active状态
 * @param {boolean} eligibilityRule.require_fee_paid - 是否要求缴纳党费
 * @param {boolean} eligibilityRule.require_no_conflict - 是否要求无冲突
 * @param {number} eligibilityRule.min_party_years - 最小党龄要求（0表示不要求）
 * @param {string|null} eligibilityRule.require_org_code - 要求的组织编码（null表示不要求）
 * @returns {Object} 电路公共输入对象
 * 
 * 需求: 3.3, 3.4, 12.5
 */
function mapRuleToPublicInputs(eligibilityRule) {
  if (!eligibilityRule) {
    throw new Error('eligibilityRule is required');
  }

  // 处理min_party_years的特殊情况：为0或未设置时，require_party_years设置为0
  const minPartyYears = eligibilityRule.min_party_years || 0;
  const requirePartyYears = minPartyYears > 0 ? 1 : 0;

  return {
    // 布尔值转换：true -> 1, false -> 0
    require_formal_member: eligibilityRule.require_formal_member ? 1 : 0,
    
    // 布尔值转换：true -> 1, false -> 0
    require_active: eligibilityRule.require_active_status ? 1 : 0,
    
    // 布尔值转换：true -> 1, false -> 0
    require_fee_paid: eligibilityRule.require_fee_paid ? 1 : 0,
    
    // 布尔值转换：true -> 1, false -> 0
    require_no_conflict: eligibilityRule.require_no_conflict ? 1 : 0,
    
    // 特殊处理：min_party_years为0或未设置时，require_party_years设置为0
    require_party_years: requirePartyYears,
    
    // 最小党龄，未设置时默认为0
    min_party_years: minPartyYears,
    
    // 是否要求特定组织编码：有值时为1，null或空时为0
    require_org_code: eligibilityRule.require_org_code ? 1 : 0,
    
    // 要求的组织编码：提取数字部分，null或空时为0
    required_org_code: eligibilityRule.require_org_code 
      ? parseInt(eligibilityRule.require_org_code) 
      : 0
  };
}

module.exports = {
  mapVCToPrivateInputs,
  mapRuleToPublicInputs
};
