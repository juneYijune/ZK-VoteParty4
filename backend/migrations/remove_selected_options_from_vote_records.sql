-- 从 vote_records 表中删除 selected_options 字段
-- 原因：投票选择使用零知识证明保护隐私，完全保密，无需存储具体选择
-- 影响：用户查看投票记录时，只能看到投票行为，无法查看具体选择了哪些选项

ALTER TABLE vote_records DROP COLUMN selected_options;

-- 说明：
-- 1. 该字段已从数据库删除，后端代码已更新
-- 2. 后端仍会验证前端提交的选项是否有效，但不会存储到数据库
-- 3. 前端显示投票记录时，会提示"投票内容保密"
-- 4. 投票选择通过零知识证明提交到链上，完全保密，任何人都无法查看
-- 5. 如需恢复该字段（不推荐，会破坏隐私保护），可以执行：
--    ALTER TABLE vote_records ADD COLUMN selected_options VARCHAR(255) NOT NULL COMMENT '选择的选项索引，如 0,2' AFTER user_address;
