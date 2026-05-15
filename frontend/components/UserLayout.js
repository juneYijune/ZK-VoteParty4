"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Card, Dropdown, Layout, Menu, Space, Typography, message, Modal } from "antd";
import { FileTextOutlined, LogoutOutlined, UserOutlined, SafetyCertificateOutlined, SettingOutlined } from "@ant-design/icons";
import { getAllVerifications, clearAllVerifications } from "@/utils/zkVerificationStorage";
import { useAuth } from "@/contexts/AuthContext";

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

function shortAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function UserLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);

  const menuItems = useMemo(
    () => [
      {
        key: "vote",
        icon: <FileTextOutlined />,
        label: "投票",
        children: [
          { key: "vote:list", label: "投票列表" },
          { key: "vote:my", label: "我的投票" },
        ],
      },
      {
        key: "my-vcs",
        icon: <SafetyCertificateOutlined />,
        label: "我的凭证",
      },
      {
        key: "party-org",
        icon: <UserOutlined />,
        label: "我的党组织",
      },
      {
        key: "settings",
        icon: <SettingOutlined />,
        label: "设置",
      },
    ],
    []
  );

  const avatarMenuItems = useMemo(
    () => [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: "个人中心",
      },
      {
        type: "divider",
      },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "退出登录",
        danger: true,
      },
    ],
    []
  );

  function handleAvatarMenuClick(e) {
    if (e.key === "logout") {
      // 提示用户是否清除验证记录
      const walletAddress = user?.address;
      const hasVerifications = walletAddress && Object.keys(getAllVerifications(walletAddress) || {}).length > 0;
      
      if (hasVerifications) {
        Modal.confirm({
          title: "退出登录",
          content: "检测到您有保存的验证记录，是否同时清除这些记录？",
          okText: "清除并退出",
          cancelText: "保留记录并退出",
          onOk: () => {
            try {
              clearAllVerifications(walletAddress);
              message.success("已清除验证记录并退出登录");
            } catch (err) {
              console.error("清除验证记录失败:", err);
              message.success("已退出登录");
            }
            logout();
          },
          onCancel: () => {
            logout();
            message.success("已退出登录");
          },
        });
      } else {
        logout();
        message.success("已退出登录");
      }
      return;
    }

    if (e.key === "profile") {
      message.info("个人中心功能待实现");
      return;
    }
  }

  const selectedKey = useMemo(() => {
    if (!pathname) return "vote:list";
    if (pathname === "/user" || pathname.startsWith("/user/votes")) return "vote:list";
    if (pathname.startsWith("/user/my-votes")) return "vote:my";
    if (pathname.startsWith("/user/my-vcs")) return "my-vcs";
    if (pathname.startsWith("/user/my-party-org")) return "party-org";
    if (pathname.startsWith("/user/settings")) return "settings";
    return "vote:list";
  }, [pathname]);

  function handleSideMenuClick(e) {
    if (e.key === "vote:list") {
      router.push("/user/votes");
      return;
    }
    if (e.key === "vote:my") {
      router.push("/user/my-votes");
      return;
    }
    if (e.key === "my-vcs") {
      router.push("/user/my-vcs");
      return;
    }
    if (e.key === "party-org") {
      router.push("/user/my-party-org");
      return;
    }
    if (e.key === "settings") {
      router.push("/user/settings");
      return;
    }
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          height: 72,
          padding: "10px 16px",
          lineHeight: "normal",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#ffffff",
          borderBottom: "1px solid rgba(15,23,42,0.10)",
        }}
      >
        <Space size={12} align="center">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1677ff 0%, #36cfc9 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            ZK
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: "rgba(15,23,42,0.92)", lineHeight: 1.15 }}>
              ZK-党务投票系统
            </Title>
            <Text style={{ color: "rgba(15,23,42,0.55)", fontSize: 12 }}>党员工作台</Text>
          </div>
        </Space>

        <Dropdown
          menu={{ items: avatarMenuItems, onClick: handleAvatarMenuClick }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Space style={{ cursor: "pointer" }}>
            <Avatar icon={<UserOutlined />} />
            <div style={{ lineHeight: 1.1 }}>
              <Text style={{ color: "rgba(15,23,42,0.88)" }}>党员</Text>
              <br />
              <Text style={{ color: "rgba(15,23,42,0.55)", fontSize: 12 }}>
                {user?.address ? shortAddress(user.address) : "未连接"}
              </Text>
            </div>
          </Space>
        </Dropdown>
      </Header>

      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          style={{
            background: "#ffffff",
            borderRight: "1px solid rgba(15,23,42,0.10)",
          }}
        >
          <Menu
            mode="inline"
            theme="light"
            items={menuItems}
            selectedKeys={[selectedKey]}
            defaultOpenKeys={["vote"]}
            onClick={handleSideMenuClick}
            style={{ background: "#ffffff" }}
          />
        </Sider>

        <Layout style={{ background: "#f5f7fb" }}>
          <Content style={{ padding: 16 }}>
            <Card
              style={{
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                border: "1px solid rgba(15,23,42,0.06)",
              }}
              styles={{ body: { padding: 16 } }}
            >
              {children}
            </Card>
          </Content>

          <Footer
            style={{
              background: "#f5f7fb",
              borderTop: "1px solid rgba(15,23,42,0.06)",
              padding: "10px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Text style={{ color: "rgba(15,23,42,0.65)" }}>
                角色：党员{user?.address ? " · " + shortAddress(user.address) : ""}
              </Text>
              <Text style={{ color: "rgba(15,23,42,0.55)" }}>© {year} ZK-党务投票系统</Text>
            </div>
          </Footer>
        </Layout>
      </Layout>
    </Layout>
  );
}
