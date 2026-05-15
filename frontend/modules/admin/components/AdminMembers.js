"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined, StopOutlined } from "@ant-design/icons";
import { ethers } from "ethers";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { connectWallet } from "@/services/wallet";
import { listPartyOrgs, revokePartyOrgAdminOffchain } from "@/services/partyOrgs";
import { getFrontendEnv } from "@/lib/env";

const { Title, Text } = Typography;

function shortAddress(addr) {
  if (!addr) return "";
  try {
    var a = ethers.getAddress(addr);
    return a.slice(0, 6) + "..." + a.slice(-4);
  } catch (e) {
    return String(addr);
  }
}

function formatUnixSeconds(sec) {
  if (sec === undefined || sec === null || sec === "") return "-";
  var s = parseInt(String(sec), 10);
  if (!Number.isFinite(s) || s <= 0) return "-";
  var d = new Date(s * 1000);
  if (!Number.isFinite(d.getTime())) return "-";
  var pad2 = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad2(d.getMonth() + 1) +
    "-" +
    pad2(d.getDate()) +
    " " +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes()) +
    ":" +
    pad2(d.getSeconds())
  );
}

function getReadableEthersError(e) {
  try {
    if (!e) return "操作失败";
    if (e.code === 4001) return "用户取消了交易";
    if (e.shortMessage) return e.shortMessage;
    if (e.reason) return String(e.reason);
    if (e.info && e.info.error && e.info.error.message) return String(e.info.error.message);
    if (e.data && typeof e.data.message === "string") return e.data.message;
    if (typeof e.message === "string" && e.message) return e.message;
    return String(e);
  } catch (err) {
    return "操作失败";
  }
}

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

export function AdminMembers() {
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokingAddr, setRevokingAddr] = useState("");
  const [chainAddrs, setChainAddrs] = useState([]);
  const [orgItems, setOrgItems] = useState([]);

  async function fetchData() {
    try {
      setLoading(true);

      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }
      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }

      await ensureExpectedChain();

      var provider = new ethers.BrowserProvider(window.ethereum);
      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, provider);

      var addrs = await contract.getAllPartyOrgs();
      var normalized = (addrs || []).map((a) => {
        try {
          return ethers.getAddress(a);
        } catch (e) {
          return String(a);
        }
      });
      setChainAddrs(normalized);

      var res = await listPartyOrgs({ page: 1, pageSize: 200 });
      var items = (res && res.items) || [];
      setOrgItems(items);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    var map = new Map();
    for (var i = 0; i < orgItems.length; i++) {
      var it = orgItems[i];
      if (!it || !it.orger_address) continue;
      try {
        map.set(ethers.getAddress(it.orger_address), it);
      } catch (e) {
        map.set(String(it.orger_address), it);
      }
    }

    return chainAddrs.map((addr) => {
      var org = map.get(addr) || null;
      return {
        key: addr,
        admin_address: addr,
        org,
      };
    });
  }, [chainAddrs, orgItems]);

  async function handleRevoke(addr) {
    try {
      if (!addr) return;
      message.info("准备撤销：" + shortAddress(addr));

      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }
      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }

      var ok = await new Promise((resolve) => {
        Modal.confirm({
          title: "确认撤销该党组织管理员？",
          content: (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Text type="secondary">该操作会在链上执行 removePartyOrg，撤销后该地址将无法创建投票。</Text>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="管理员地址">
                  <Text code>{addr}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          ),
          okText: "确认撤销",
          cancelText: "取消",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!ok) return;

      setRevoking(true);
      setRevokingAddr(addr);
      await ensureExpectedChain();

      var adminAddr = await connectWallet();
      if (!adminAddr) throw new Error("未获取到钱包地址");

      var provider = new ethers.BrowserProvider(window.ethereum);
      var signer = await provider.getSigner();
      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, signer);

      var tx = await contract.removePartyOrg(addr);
      var receipt = await tx.wait();

      var blockNumber = receipt && receipt.blockNumber;
      var txHash = tx && tx.hash;
      var block = blockNumber ? await provider.getBlock(blockNumber) : null;
      var blockTs = block && block.timestamp;

      await revokePartyOrgAdminOffchain({
        orger_address: addr,
        block_height: blockNumber || null,
        transaction_hash: txHash || null,
      });

      Modal.success({
        title: "撤销成功",
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="交易哈希">
                <Text code>{txHash || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">{blockNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="区块时间">{formatUnixSeconds(blockTs)}</Descriptions.Item>
            </Descriptions>
            <Text type="secondary">链下已同步：已清空 party_orgs.orger_address 并将 status 置为停用。</Text>
          </Space>
        ),
      });

      await fetchData();
    } catch (e) {
      console.error(e);
      message.error(getReadableEthersError(e) || "撤销失败");
    } finally {
      setRevoking(false);
      setRevokingAddr("");
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            成员管理
          </Title>
          <Text type="secondary">链上党组织管理员列表（来自合约 ）。</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
        <Table
          rowKey="key"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: "党组织",
              dataIndex: "org",
              render: (org) => {
                if (!org) return <Text type="secondary">未关联数据库记录</Text>;
                return (
                  <Space direction="vertical" size={0}>
                    <Text>{org.org_name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {org.org_code}
                    </Text>
                  </Space>
                );
              },
            },
            {
              title: "管理员地址",
              dataIndex: "admin_address",
              render: (v) => <Text code>{shortAddress(v)}</Text>,
            },
            {
              title: "数据库状态",
              dataIndex: ["org", "status"],
              render: (v, row) => {
                if (!row.org) return "-";
                return v === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>;
              },
            },
            {
              title: "操作",
              key: "action",
              render: (_, row) => (
                <Button
                  danger
                  icon={<StopOutlined />}
                  loading={revoking && revokingAddr === row.admin_address}
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    handleRevoke(row.admin_address);
                  }}
                >
                  撤销
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
