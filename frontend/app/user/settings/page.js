"use client";

import { UserLayout } from "@/components";
import { VerificationRecordsManager } from "@/modules/user/components/VerificationRecordsManager";
import { useWallet } from "@/hooks";
import { Card, Typography, Space } from "antd";
import { SettingOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function UserSettingsPage() {
  const { account } = useWallet();

  return (
    <UserLayout>
      <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          {/* 页面标题 */}
          <Card
            bordered={false}
            style={{
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
          >
            <Space align="center" size={16}>
              <SettingOutlined style={{ fontSize: "48px", color: "#fff" }} />
              <div>
                <Title level={2} style={{ margin: 0, color: "#fff" }}>
                  用户设置
                </Title>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                  管理您的验证记录和个人设置
                </Text>
              </div>
            </Space>
          </Card>

          {/* 验证记录管理 */}
          <VerificationRecordsManager walletAddress={account} />
        </Space>
      </div>
    </UserLayout>
  );
}
