-- 修改 party_orgs 表，允许 orger_address 为 NULL
-- 这样撤销党组织管理员时可以将地址设置为 NULL，避免唯一键冲突

ALTER TABLE party_orgs 
MODIFY COLUMN orger_address CHAR(42) DEFAULT NULL COMMENT '区块链党组织管理员地址';

-- 说明：
-- 1. 将 NOT NULL 约束改为允许 NULL
-- 2. 保留 UNIQUE 约束
-- 3. 撤销党组织时，orger_address 设置为 NULL
-- 4. 重启党组织时，orger_address 设置为新地址
