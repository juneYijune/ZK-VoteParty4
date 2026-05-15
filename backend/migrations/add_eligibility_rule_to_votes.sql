-- 为 votes 表添加投票资格规则字段
ALTER TABLE votes
ADD COLUMN eligibility_rule JSON DEFAULT NULL COMMENT '投票资格规则定义（链下明文规则）',
ADD COLUMN eligibility_rule_hash CHAR(66) DEFAULT NULL COMMENT '资格规则哈希（与合约 eligibilityRuleHash 一致）';
