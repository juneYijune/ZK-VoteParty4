"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Badge, Card, Dropdown, Layout, Menu, Space, Typography, message } from "antd";
import {
  BellOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SafetyOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

function shortAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);

  const menuItems = useMemo(
    () => [
      {
        key: "party-org",
        icon: <TeamOutlined />,
        label: "党组织管理",
        children: [
          { key: "party-org:list", label: "党组织列表" },
          { key: "party-org:members", label: "成员管理" },
        ],
      },
      {
        key: "vote",
        icon: <FileTextOutlined />,
        label: "投票管理",
        children: [
          { key: "vote:list", label: "投票列表" },
          { key: "vote:create", label: "创建投票" },
        ],
      },
      {
        key: "audit",
        icon: <SafetyOutlined />,
        label: "审计日志",
        children: [{ key: "audit:list", label: "日志查询" }],
      },
      {
        key: "settings",
        icon: <SettingOutlined />,
        label: "系统设置",
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
      logout();
      message.success("已退出登录");
      return;
    }

    if (e.key === "profile") {
      message.info("个人中心功能待实现");
      return;
    }
  }

  const selectedKey = useMemo(() => {
    if (!pathname) return "party-org:list";
    if (pathname === "/admin") return "party-org:list";
    if (pathname.startsWith("/admin/members")) return "party-org:members";
    if (pathname.startsWith("/admin/logs")) return "audit:list";
    return "party-org:list";
  }, [pathname]);

  function handleSideMenuClick(e) {
    if (e.key === "party-org:list") {
      router.push("/admin");
      return;
    }
    if (e.key === "party-org:members") {
      router.push("/admin/members");
      return;
    }
    if (e.key === "audit:list") {
      router.push("/admin/logs");
      return;
    }
    message.info("功能待实现");
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
              background: "linear-gradient(135deg, #60a5fa 0%, #22d3ee 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b1220",
              fontWeight: 800,
            }}
          >
            ZK
          </div>
          <div>
            <Title
              level={4}
              style={{ margin: 0, color: "rgba(15,23,42,0.92)", lineHeight: 1.15 }}
            >
              ZK-党务投票系统
            </Title>
            <Text style={{ color: "rgba(15,23,42,0.55)", fontSize: 12 }}>
              系统管理员工作台
            </Text>
          </div>
        </Space>

        <Space size={16} align="center">
          <Badge count={0} size="small">
            <BellOutlined style={{ fontSize: 18, color: "rgba(15,23,42,0.78)" }} />
          </Badge>

          <Dropdown
            menu={{ items: avatarMenuItems, onClick: handleAvatarMenuClick }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <Space style={{ cursor: "pointer" }}>
              <Avatar icon={<UserOutlined />} />
              <div style={{ lineHeight: 1.1 }}>
                <Text style={{ color: "rgba(15,23,42,0.88)" }}>系统管理员</Text>
                <br />
                <Text style={{ color: "rgba(15,23,42,0.55)", fontSize: 12 }}>
                  {user?.address ? shortAddress(user.address) : "未连接"}
                </Text>
              </div>
            </Space>
          </Dropdown>
        </Space>
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
                角色：系统管理员{user?.address ? " · " + shortAddress(user.address) : ""}
              </Text>
              <Text style={{ color: "rgba(15,23,42,0.55)" }}>© {year} ZK-党务投票系统</Text>
            </div>
          </Footer>
        </Layout>
      </Layout>
    </Layout>
  );
}
