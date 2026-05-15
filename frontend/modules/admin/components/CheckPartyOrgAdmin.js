import { useState } from "react";
import { Button, Card, Form, Input, Space, Tag, Typography, message, Row, Col } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { ethers } from "ethers";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { getFrontendEnv } from "@/lib/env";

const { Text } = Typography;

// 确保连接到正确的网络
async function ensureExpectedChain() {
  const env = getFrontendEnv();
  const expectedChainId = parseInt(env.chainId || "31337", 10);
  const expectedChainHex = "0x" + expectedChainId.toString(16);

  const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });
  if (currentChainHex === expectedChainHex) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedChainHex }],
    });
  } catch (switchError) {
    if (switchError && switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: expectedChainHex,
            chainName: "Hardhat Localhost",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          },
        ],
      });
      return;
    }
    throw switchError;
  }
}

export function CheckPartyOrgAdmin() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // 查询地址是否为党组织管理员
  async function handleCheck() {
    try {
      const values = await form.validateFields();
      const address = values.address;

      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }

      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      setLoading(true);
      setResult(null);

      await ensureExpectedChain();

      var provider = new ethers.BrowserProvider(window.ethereum);

      var code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error("当前网络该地址没有部署合约，请确认网络与合约部署一致");
      }

      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, provider);

      // 调用合约方法查询
      var isAdmin = await contract.getisPartyOrgAdmin(address);

      setResult({
        address: address,
        isAdmin: isAdmin,
      });

      if (isAdmin) {
        message.success("该地址是党组织管理员");
      } else {
        message.info("该地址不是党组织管理员");
      }
    } catch (e) {
      console.error("查询失败:", e);
      message.error(e.message || "查询失败");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title="查询党组织管理员"
      style={{ borderRadius: 12 }}
      styles={{ body: { padding: 16 } }}
    >
      <Form form={form} layout="inline">
        <Row gutter={12} style={{ width: "100%" }} align="middle">
          <Col xs={24} sm={16} md={12} lg={10}>
            <Form.Item
              name="address"
              style={{ marginBottom: 0, width: "100%" }}
              rules={[
                { required: true, message: "请输入钱包地址" },
                {
                  validator: async (_, v) => {
                    if (!v) return;
                    if (!ethers.isAddress(v)) throw new Error("地址格式不正确");
                  },
                },
              ]}
            >
              <Input placeholder="输入钱包地址查询，例如：0x..." />
            </Form.Item>
          </Col>

          <Col xs={12} sm={8} md={4} lg={3}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleCheck}
              loading={loading}
              block
            >
              查询
            </Button>
          </Col>

          {result && (
            <Col xs={12} sm={24} md={8} lg={11}>
              <Space>
                <Text type="secondary">查询结果：</Text>
                {result.isAdmin ? (
                  <Tag color="success">是党组织管理员</Tag>
                ) : (
                  <Tag color="warning">不是党组织管理员</Tag>
                )}
              </Space>
            </Col>
          )}
        </Row>
      </Form>
    </Card>
  );
}
