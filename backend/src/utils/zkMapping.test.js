/**
 * 测试zkMapping工具函数
 */

const { mapVCToPrivateInputs, mapRuleToPublicInputs } = require('./zkMapping');

describe('mapVCToPrivateInputs', () => {
  test('正确映射完整的VC内容', () => {
    const vcContent = {
      isFormalPartyMember: true,
      partyStatus: 1,
      paidPartyFee: true,
      conflictFree: true,
      partyYears: 5,
      partyOrgCode: 'ORG001'
    };

    const result = mapVCToPrivateInputs(vcContent);

    expect(result).toEqual({
      is_formal_member: 1,
      is_active: 1,
      fee_paid: 1,
      no_conflict: 1,
      voter_party_years: 5,
      voter_org_code: 1
    });
  });

  test('正确转换布尔值false为0', () => {
    const vcContent = {
      isFormalPartyMember: false,
      partyStatus: 0,
      paidPartyFee: false,
      conflictFree: false,
      partyYears: 0,
      partyOrgCode: 'ORG000'
    };

    const result = mapVCToPrivateInputs(vcContent);

    expect(result).toEqual({
      is_formal_member: 0,
      is_active: 0,
      fee_paid: 0,
      no_conflict: 0,
      voter_party_years: 0,
      voter_org_code: 0
    });
  });

  test('partyStatus非1时转换为0', () => {
    const testCases = [0, 2, 3, -1, null, undefined];

    testCases.forEach(status => {
      const vcContent = {
        isFormalPartyMember: true,
        partyStatus: status,
        paidPartyFee: true,
        conflictFree: true,
        partyYears: 5,
        partyOrgCode: 'ORG001'
      };

      const result = mapVCToPrivateInputs(vcContent);
      expect(result.is_active).toBe(0);
    });
  });

  test('正确提取partyOrgCode中的数字', () => {
    const testCases = [
      { input: 'ORG001', expected: 1 },
      { input: 'ORG123', expected: 123 },
      { input: 'ABC456DEF', expected: 456 },
      { input: '789', expected: 789 },
      { input: 'ABC', expected: 0 },
      { input: 'ORG000', expected: 0 }
    ];

    testCases.forEach(({ input, expected }) => {
      const vcContent = {
        isFormalPartyMember: true,
        partyStatus: 1,
        paidPartyFee: true,
        conflictFree: true,
        partyYears: 5,
        partyOrgCode: input
      };

      const result = mapVCToPrivateInputs(vcContent);
      expect(result.voter_org_code).toBe(expected);
    });
  });

  test('抛出错误当vcContent为null或undefined', () => {
    expect(() => mapVCToPrivateInputs(null)).toThrow('vcContent is required');
    expect(() => mapVCToPrivateInputs(undefined)).toThrow('vcContent is required');
  });
});

describe('mapRuleToPublicInputs', () => {
  test('正确映射完整的资格规则', () => {
    const eligibilityRule = {
      require_formal_member: true,
      require_active_status: true,
      require_fee_paid: true,
      require_no_conflict: true,
      min_party_years: 5,
      require_org_code: '123'
    };

    const result = mapRuleToPublicInputs(eligibilityRule);

    expect(result).toEqual({
      require_formal_member: 1,
      require_active: 1,
      require_fee_paid: 1,
      require_no_conflict: 1,
      require_party_years: 1,
      min_party_years: 5,
      require_org_code: 1,
      required_org_code: 123
    });
  });

  test('正确转换布尔值false为0', () => {
    const eligibilityRule = {
      require_formal_member: false,
      require_active_status: false,
      require_fee_paid: false,
      require_no_conflict: false,
      min_party_years: 0,
      require_org_code: null
    };

    const result = mapRuleToPublicInputs(eligibilityRule);

    expect(result).toEqual({
      require_formal_member: 0,
      require_active: 0,
      require_fee_paid: 0,
      require_no_conflict: 0,
      require_party_years: 0,
      min_party_years: 0,
      require_org_code: 0,
      required_org_code: 0
    });
  });

  test('min_party_years为0时，require_party_years设置为0', () => {
    const eligibilityRule = {
      require_formal_member: true,
      require_active_status: true,
      require_fee_paid: true,
      require_no_conflict: true,
      min_party_years: 0,
      require_org_code: null
    };

    const result = mapRuleToPublicInputs(eligibilityRule);

    expect(result.require_party_years).toBe(0);
    expect(result.min_party_years).toBe(0);
  });

  test('min_party_years未设置时，require_party_years设置为0', () => {
    const eligibilityRule = {
      require_formal_member: true,
      require_active_status: true,
      require_fee_paid: true,
      require_no_conflict: true,
      require_org_code: null
    };

    const result = mapRuleToPublicInputs(eligibilityRule);

    expect(result.require_party_years).toBe(0);
    expect(result.min_party_years).toBe(0);
  });

  test('min_party_years大于0时，require_party_years设置为1', () => {
    const testCases = [1, 5, 10, 100];

    testCases.forEach(years => {
      const eligibilityRule = {
        require_formal_member: true,
        require_active_status: true,
        require_fee_paid: true,
        require_no_conflict: true,
        min_party_years: years,
        require_org_code: null
      };

      const result = mapRuleToPublicInputs(eligibilityRule);
      expect(result.require_party_years).toBe(1);
      expect(result.min_party_years).toBe(years);
    });
  });

  test('require_org_code为null时，require_org_code和required_org_code都为0', () => {
    const eligibilityRule = {
      require_formal_member: true,
      require_active_status: true,
      require_fee_paid: true,
      require_no_conflict: true,
      min_party_years: 5,
      require_org_code: null
    };

    const result = mapRuleToPublicInputs(eligibilityRule);

    expect(result.require_org_code).toBe(0);
    expect(result.required_org_code).toBe(0);
  });

  test('require_org_code为空字符串时，require_org_code和required_org_code都为0', () => {
    const eligibilityRule = {
      require_formal_member: true,
      require_active_status: true,
      require_fee_paid: true,
      require_no_conflict: true,
      min_party_years: 5,
      require_org_code: ''
    };

    const result = mapRuleToPublicInputs(eligibilityRule);

    expect(result.require_org_code).toBe(0);
    expect(result.required_org_code).toBe(0);
  });

  test('正确解析require_org_code中的数字', () => {
    const testCases = [
      { input: '123', expected: 123 },
      { input: '1', expected: 1 },
      { input: '999', expected: 999 }
    ];

    testCases.forEach(({ input, expected }) => {
      const eligibilityRule = {
        require_formal_member: true,
        require_active_status: true,
        require_fee_paid: true,
        require_no_conflict: true,
        min_party_years: 5,
        require_org_code: input
      };

      const result = mapRuleToPublicInputs(eligibilityRule);
      expect(result.require_org_code).toBe(1);
      expect(result.required_org_code).toBe(expected);
    });
  });

  test('抛出错误当eligibilityRule为null或undefined', () => {
    expect(() => mapRuleToPublicInputs(null)).toThrow('eligibilityRule is required');
    expect(() => mapRuleToPublicInputs(undefined)).toThrow('eligibilityRule is required');
  });
});
