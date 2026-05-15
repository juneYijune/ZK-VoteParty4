"use client";

import { useEffect, useState } from "react";
import { Card, Col, Descriptions, Divider, Empty, List, Row, Space, Statistic, Tag, Typography, message } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  StopOutlined,
  TeamOutlined,
  TrophyOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { ethers } from "ethers";
import dayjs from "dayjs";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { connectWallet } from "@/services/wallet";
import { getFrontendEnv } from "@/lib/env";
import { getPartyOrgByAddress } from "@/services/partyOrgs";

const { Title, Text } = Typography;

// 投票类型映射
function voteTypeLabel(v) {
  if (v === 0 || v === "0" || String(v).toUpperCase() === "ELECTION") return "差额选举";
  if (v === 1 || v === "1" || String(v).toUpperCase() === "RESOLUTION") return "决议表决";
  if (v === 2 || v === "2" || String(v).toUpperCase() === "EVALUATION") return "评议评价";
  return String(v || "-");
}

// 投票状态标签
function voteStatusTag(status, startTime, endTime) {
  var now = Math.floor(Date.now() / 1000);
  var start = Number(startTime);
  var end = Number(endTime);

  if (status === 2 || now > end) {
    return <Tag icon={<StopOutlined />} color="default">投票已关闭</Tag>;
  }
  if (status === 1 && now >= start && now <= end) {
    return <Tag icon={<CheckCircleOutlined />} color="success">投票已开启</Tag>;
  }
  return <Tag icon={<ClockCircleOutlined />} color="warning">投票未开启</Tag>;
}

// 格式化时间戳
function formatTimestamp(timestamp) {
  if (!timestamp) return "-";
  return dayjs.unix(Number(timestamp)).format("YYYY-MM-DD HH:mm");
}

export function PartyOrgHome() {
  const [loading, setLoading] = useState(false);
  const [orgAddress, setOrgAddress] = useState("");
  const [orgInfo, setOrgInfo] = useState(null);
  
  const [totalVotes, setTotalVotes] = useState(0);
  const [activeVotes, setActiveVotes] = useState(0);
  const [endedVotes, setEndedVotes] = useState(0);
  
  const [recentVotes, setRecentVotes] = useState([]);

  // 获取党组织信息和投票数据
  async function fetchData() {
    try {
      setLoading(true);

      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }

      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      const env = getFrontendEnv();
      const expectedChainId = parseInt(env.chainId || "31337", 10);
      const expectedChainHex = "0x" + expectedChainId.toString(16);
      const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });

      if (currentChainHex !== expectedChainHex) {
        throw new Error("请切换到正确的网络");
      }

      var address = await connectWallet();
      if (!address) throw new Error("未获取到钱包地址");

      setOrgAddress(address);

      // 从数据库获取党组织信息
      try {
        var orgData = await getPartyOrgByAddress(address);
        setOrgInfo(orgData);
      } catch (e) {
        console.error("获取党组织信息失败:", e);
        // 继续执行，不影响其他数据加载
      }

      var provider = new ethers.BrowserProvider(window.ethereum);
      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, provider);

      // 获取党组织创建的所有投票ID
      var voteIds = await contract.getVotesByPartyOrg(address);
      setTotalVotes(voteIds.length);

      if (voteIds.length === 0) {
        setRecentVotes([]);
        return;
      }

      // 获取每个投票的详细信息
      var votes = [];
      var now = Math.floor(Date.now() / 1000);
      var activeCount = 0;
      var endedCount = 0;

      for (var i = 0; i < voteIds.length; i++) {
        var voteId = voteIds[i];
        var info = await contract.getVoteInfo(voteId);

        var voteData = {
          id: Number(voteId),
          title: info[1],
          voteType: Number(info[2]),
          status: Number(info[3]),
          startTime: Number(info[4]),
          endTime: Number(info[5]),
          maxChoices: Number(info[6]),
          partyOrg: info[7],
          options: info[8],
        };

        votes.push(voteData);

        // 统计状态
        if (voteData.status === 2 || now > voteData.endTime) {
          endedCount++;
        } else if (voteData.status === 1 && now >= voteData.startTime && now <= voteData.endTime) {
          activeCount++;
        }
      }

      setActiveVotes(activeCount);
      setEndedVotes(endedCount);

      // 按ID降序排序，取最近5条
      votes.sort((a, b) => b.id - a.id);
      setRecentVotes(votes.slice(0, 5));
    } catch (e) {
      console.error("获取数据失败:", e);
      message.error(e.message || "获取数据失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* 党组织信息卡片 */}
        <Card 
          loading={loading}
          bordered={false}
          style={{ 
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        >
          {orgInfo ? (
            <div>
              <Space align="center" size={16} style={{ marginBottom: "24px" }}>
                <TeamOutlined style={{ fontSize: "32px", color: "#1890ff" }} />
                <div>
                  <Title level={3} style={{ margin: 0 }}>
                    {orgInfo.org_name}
                  </Title>
                  <Text type="secondary">{orgInfo.org_code}</Text>
                </div>
                {orgInfo.status === 1 ? (
                  <Tag color="success" style={{ marginLeft: "auto" }}>启用中</Tag>
                ) : (
                  <Tag color="error" style={{ marginLeft: "auto" }}>已停用</Tag>
                )}
              </Space>
              
              <Divider style={{ margin: "16px 0" }} />
              
              <Row gutter={[24, 16]}>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">党组织类型</Text>
                    <Text strong>{orgInfo.org_type || "-"}</Text>
                  </Space>
                </Col>
                <Col xs={24} sm={12}>
                  <Space direction="vertical" size={4}>
                    <Text type="secondary">负责人</Text>
                    <Text strong>{orgInfo.leader_name || "-"}</Text>
                  </Space>
                </Col>
                {orgInfo.description && (
                  <Col xs={24}>
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">组织简介</Text>
                      <Text>{orgInfo.description}</Text>
                    </Space>
                  </Col>
                )}
              </Row>
            </div>
          ) : (
            <Empty 
              description="未找到党组织信息" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>

        {/* 投票统计卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card 
              bordered={false}
              style={{ 
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              }}
            >
              <Statistic
                title={<span style={{ color: "rgba(255,255,255,0.85)" }}>已创建投票</span>}
                value={totalVotes}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: "#fff", fontSize: "32px" }}
                suffix={<span style={{ fontSize: "16px", color: "rgba(255,255,255,0.85)" }}>个</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card 
              bordered={false}
              style={{ 
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
              }}
            >
              <Statistic
                title={<span style={{ color: "rgba(255,255,255,0.85)" }}>进行中投票</span>}
                value={activeVotes}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: "#fff", fontSize: "32px" }}
                suffix={<span style={{ fontSize: "16px", color: "rgba(255,255,255,0.85)" }}>个</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card 
              bordered={false}
              style={{ 
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
              }}
            >
              <Statistic
                title={<span style={{ color: "rgba(255,255,255,0.85)" }}>已结束投票</span>}
                value={endedVotes}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: "#fff", fontSize: "32px" }}
                suffix={<span style={{ fontSize: "16px", color: "rgba(255,255,255,0.85)" }}>个</span>}
              />
            </Card>
          </Col>
        </Row>

        {/* 最近创建的投票 */}
        <Card 
          title={
            <Space>
              <CalendarOutlined style={{ color: "#1890ff" }} />
              <span>最近创建的投票</span>
            </Space>
          }
          loading={loading}
          bordered={false}
          style={{ 
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        >
          {recentVotes.length === 0 ? (
            <Empty 
              description="暂无投票记录" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={recentVotes}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: "16px 0",
                    borderBottom: "1px solid #f0f0f0"
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "8px",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: "20px",
                          fontWeight: "bold"
                        }}
                      >
                        {item.voteType === 0 ? "选" : item.voteType === 1 ? "决" : "评"}
                      </div>
                    }
                    title={
                      <Space size={8}>
                        <Text strong style={{ fontSize: "16px" }}>{item.title}</Text>
                        <Tag color="blue">{voteTypeLabel(item.voteType)}</Tag>
                        {voteStatusTag(item.status, item.startTime, item.endTime)}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4} style={{ marginTop: "8px" }}>
                        <Space size={16}>
                          <Text type="secondary">
                            <ClockCircleOutlined /> 开始时间: {formatTimestamp(item.startTime)}
                          </Text>
                          <Text type="secondary">
                            <ClockCircleOutlined /> 结束时间: {formatTimestamp(item.endTime)}
                          </Text>
                        </Space>
                        <Text type="secondary">
                          最多可选 {item.maxChoices} 项 · 共 {item.options.length} 个选项
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </div>
  );
}
