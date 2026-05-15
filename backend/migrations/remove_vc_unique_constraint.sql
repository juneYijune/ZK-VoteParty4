-- 移除 verifiable_credentials 表的唯一键约束，允许用户拥有多个同类型的 VC
ALTER TABLE verifiable_credentials
DROP INDEX uk_wallet_vc;

-- 添加普通索引以提高查询性能
ALTER TABLE verifiable_credentials
ADD INDEX idx_wallet_type (vc_holder_wallet_hash, vc_type);
