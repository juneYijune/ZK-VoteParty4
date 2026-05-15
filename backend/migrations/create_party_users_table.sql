-- 创建党员用户表
CREATE TABLE IF NOT EXISTS party_users (
  partyuser_id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID（链下）',
  user_name VARCHAR(50) NOT NULL COMMENT '党员姓名（仅链下）',
  id_number_hash CHAR(66) COMMENT '身份证号哈希（不存明文）',
  wallet_address CHAR(42) UNIQUE COMMENT '绑定的钱包地址',
  wallet_address_hash CHAR(66) UNIQUE COMMENT '钱包地址哈希（ZK用）',
  user_role TINYINT NOT NULL DEFAULT 1 COMMENT '角色：1党员 2党组织管理员 9系统管理员',
  party_org_id BIGINT COMMENT '所属党组织ID（链下）',
  user_status TINYINT DEFAULT 2 COMMENT '状态 1正常 0冻结 2申请中',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (party_org_id) REFERENCES party_orgs(org_id) ON DELETE SET NULL,
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_party_org_id (party_org_id),
  INDEX idx_user_status (user_status)
) COMMENT='系统用户表';
