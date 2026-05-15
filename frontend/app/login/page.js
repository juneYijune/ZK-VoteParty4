"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Space, Typography, message } from "antd";
import { ethers } from "ethers";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { fetchWalletNonce, walletLogin } from "@/services/auth";
import { PartyVotingContract } from "@/contracts/partyVoting";
import { getFrontendEnv } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Roles } from "@/constants/roles";

const { Title, Paragraph, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const { address: connectedAddress, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);

  // 显示错误信息
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'unauthorized') {
      message.error('您没有权限访问该页面');
    }
  }, [searchParams]);

  async function handleLogin() {
    // 中文说明：钱包签名登录完整流程
    // 1）钱包已通过 RainbowKit 连接
    // 2）请求后端生成 nonce（Redis 存储）
    // 3）调用 personal_sign 签名 nonce
    // 4）把签名发送到后端校验，后端校验通过后删除 nonce（防重放）
    // 5）校验成功后调用合约 view 方法判断角色并跳转

    if (!isConnected || !connectedAddress) {
      message.error("请先连接钱包");
      return;
    }

    try {
      setLoading(true);

      // 统一 address 格式
      const addr = ethers.getAddress(connectedAddress);

      // 2) 获取 nonce
      const nonce = await fetchWalletNonce(addr);

      // 3) 使用 personal_sign 签名（与后端验证一致）
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [nonce, addr],
      });

      // 4) 登录
      await walletLogin(addr, signature);

      // 5) 读取合约判断角色
      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);

      // 中文说明：调用合约前先检查该地址是否真的部署了合约（避免返回 0x 导致解码失败）
      const code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error(
          "当前网络该地址没有部署合约，请确认网络正确且合约已部署"
        );
      }

      const contract = new ethers.Contract(
        PartyVotingContract.address,
        PartyVotingContract.abi,
        provider
      );

      const adminAddr = await contract.getAdmin();
      const isPartyOrgAdmin = await contract.getisPartyOrgAdmin(addr);

      const adminChecksum = ethers.getAddress(adminAddr);

      // 确定用户角色
      let userRole = Roles.USER;
      let redirectPath = "/user";

      if (addr === adminChecksum) {
        userRole = Roles.SYSTEM_ADMIN;
        redirectPath = "/admin";
      } else if (isPartyOrgAdmin) {
        userRole = Roles.PARTY_ORG_ADMIN;
        redirectPath = "/partyorg";
      }

      // 保存用户信息到认证上下文
      login({
        address: addr,
        role: userRole,
        loginAt: Date.now(),
      });

      // 同时保存到 localStorage（兼容现有代码）
      localStorage.setItem("wallet_address", addr);
      localStorage.setItem("wallet_login_at", String(Date.now()));

      message.success(`登录成功：${userRole === Roles.SYSTEM_ADMIN ? '系统管理员' : userRole === Roles.PARTY_ORG_ADMIN ? '党组织管理员' : '党员（用户）'}`);
      
      // 检查是否有重定向参数
      const redirect = searchParams.get('redirect');
      const targetPath = redirect || redirectPath;
      
      // 使用完整页面跳转而不是客户端路由，确保 Cookie 被服务端识别
      // 延迟确保 Cookie 设置完成
      setTimeout(() => {
        window.location.href = targetPath;
      }, 300);
    } catch (e) {
      console.error(e);
      message.error(e.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 10% 10%, rgba(56,189,248,0.35) 0%, rgba(2,6,23,0) 55%), radial-gradient(900px 450px at 90% 20%, rgba(99,102,241,0.35) 0%, rgba(2,6,23,0) 55%), linear-gradient(135deg, #0b1220 0%, #0b1b3a 45%, #071426 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: 560, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 14, color: "rgba(255,255,255,0.92)" }}>
          <Title level={2} style={{ margin: 0, color: "rgba(255,255,255,0.92)" }}>
            ZK-党务投票系统
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.72)" }}>安全登录</Text>
        </div>

        <Card
          title="系统登录"
          style={{
            borderRadius: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
          styles={{
            body: {
              padding: 20,
              background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.88) 100%)",
              borderRadius: 14,
            },
            header: {
              background: "rgba(255,255,255,0.70)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
            },
          }}
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Paragraph style={{ marginBottom: 0, color: "rgba(0,0,0,0.65)" }}>
              使用以太坊钱包登录，无需密码。支持 MetaMask、Coinbase Wallet、Rainbow 等多种钱包。
            </Paragraph>

            <div>
              <Text type="secondary">当前钱包：</Text>
              <Text code>{connectedAddress || "未连接"}</Text>
            </div>

            {!isConnected ? (
              <Alert
                type="info"
                showIcon
                message="请先连接钱包"
                description="点击下方按钮选择并连接您的以太坊钱包。"
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message="钱包已连接"
                description="点击登录按钮完成身份验证。"
              />
            )}

            {/* RainbowKit 连接按钮 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <ConnectButton />
            </div>

            {/* 登录按钮 */}
            {isConnected && (
              <Button
                type="primary"
                block
                size="large"
                loading={loading}
                onClick={handleLogin}
              >
                签名并登录
              </Button>
            )}

            <Text type="secondary" style={{ fontSize: 12 }}>
              登录不会产生链上交易，仅用于身份校验。
            </Text>
          </Space>
        </Card>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Text style={{ color: "rgba(255,255,255,0.55)" }}>© {year} ZK-党务投票系统</Text>
        </div>
      </div>
    </div>
  );
}
