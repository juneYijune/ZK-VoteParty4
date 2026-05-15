"use client";

import { useEffect, useState } from "react";
import { 
  Card, 
  Col, 
  Empty, 
  Row, 
  Space, 
  Tag, 
  Typography, 
  message, 
  Spin,
  Progress,
  Button,
  Statistic,
  Modal,
  Descriptions,
  List,
  Divider,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  TeamOutlined,
  TrophyOutlined,
  EyeOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { ethers } from "ethers";
import dayjs from "dayjs";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { getFrontendEnv } from "@/lib/env";

const { Title, Text, Paragraph } = Typography;

// 投票类型映射
function voteTypeLabel(v) {
  if (v === 0 || v === "0" || String(v).toUpperCase() === "ELECTION") return "差额选举";
  if (v === 1 || v === "1" || String(v).toUpperCase() === "RESOLUTION") return "决议表决";
  if (v === 2 || v === "2" || String(v).toUpperCase() === "EVALUATION") return "评议评价";
  return String(v || "-");
}

// 投票类型颜色
function voteTypeColor(v) {
  if (v === 0) return "blue";
  if (v === 1) return "green";
  if (v === 2) return "orange";
  return "default";
}

// 格式化时间戳
function formatTimestamp(timestamp) {
  if (!timestamp) return "-";
  return dayjs.unix(Number(timestamp)).format("YYYY-MM-DD HH:mm");
}

// 计算剩余时间
function getTimeRemaining(endTime) {
  var now = Math.floor(Date.now() / 1000);
  var end = Number(endTime);
  var remaining = end - now;
  
  if (remaining <= 0) return "已结束";
  
  var days = Math.floor(remaining / 86400);
  var hours = Math.floor((remaining % 86400) / 3600);
  var minutes = Math.floor((remaining % 3600) / 60);
  
  if (days > 0) return `剩余 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `剩余 ${hours} 小时 ${minutes} 分钟`;
  return `剩余 ${minutes} 分钟`;
}

// 计算投票进度
function getVoteProgress(endTime, startTime) {
  var now = Math.floor(Date.now() / 1000);
  var start = Number(startTime);
  var end = Number(endTime);
  var total = end - start;
  var elapsed = now - start;
  
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;
  
  return Math.floor((elapsed / total) * 100);
}

// 缩短地址显示
function shortAddress(addr) {
  if (!addr) return "";
  try {
    var a = ethers.getAddress(addr);
    return a.slice(0, 6) + "..." + a.slice(-4);
  } catch (e) {
    return addr;
  }
}

export function HotVotes() {
  const [loading, setLoading] = useState(false);
  const [hotVotes, setHotVotes] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
  });

  // 详情模态框状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 获取所有正在进行的投票
  async function fetchHotVotes() {
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

      var provider = new ethers.BrowserProvider(window.ethereum);
      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, provider);

      // 获取投票总数
      var voteCount = await contract.voteCount();
      var totalCount = Number(voteCount);

      if (totalCount === 0) {
        setHotVotes([]);
        setStats({ total: 0, active: 0 });
        return;
      }

      // 获取所有投票信息
      var votes = [];
      var activeCount = 0;

      for (var i = 1; i <= totalCount; i++) {
        try {
          var info = await contract.getVoteInfo(i);
          
          var voteData = {
            id: i,
            title: info[1],
            voteType: Number(info[2]),
            status: Number(info[3]),
            startTime: Number(info[4]),
            endTime: Number(info[5]),
            maxChoices: Number(info[6]),
            partyOrg: info[7],
            options: info[8],
            partyOrgName: "", // 将通过地址获取党组织名称
          };

          // 只显示状态为1（已开启）的投票
          if (voteData.status === 1) {
            votes.push(voteData);
            activeCount++;
          }
        } catch (e) {
          console.error(`获取投票 ${i} 信息失败:`, e);
        }
      }

      // 批量获取党组织名称
      for (var j = 0; j < votes.length; j++) {
        try {
          var orgInfo = await contract.getPartyOrgInfo(votes[j].partyOrg);
          votes[j].partyOrgName = orgInfo[0] || shortAddress(votes[j].partyOrg);
        } catch (e) {
          votes[j].partyOrgName = shortAddress(votes[j].partyOrg);
        }
      }

      // 按结束时间排序，即将结束的排在前面
      votes.sort((a, b) => a.endTime - b.endTime);

      setHotVotes(votes);
      setStats({
        total: totalCount,
        active: activeCount,
      });
    } catch (e) {
      console.error("获取热门投票失败:", e);
      message.error(e.message || "获取热门投票失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHotVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 查看投票详情
  async function handleViewVote(vote) {
    try {
      setSelectedVote(vote);
      setDetailModalVisible(true);
      setLoadingDetail(true);

      // 可以在这里获取更多详细信息，比如投票结果等
      // 目前已经有基本信息了，所以直接显示
      setLoadingDetail(false);
    } catch (e) {
      console.error("获取投票详情失败:", e);
      message.error(e.message || "获取投票详情失败");
      setLoadingDetail(false);
    }
  }

  // 关闭详情模态框
  function handleCloseDetail() {
    setDetailModalVisible(false);
    setSelectedVote(null);
  }

  return (
    <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* 页面标题和统计 */}
        <Card 
          bordered={false}
          style={{ 
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          }}
        >
          <Row gutter={24} align="middle">
            <Col flex="auto">
              <Space align="center" size={16}>
                <FireOutlined style={{ fontSize: "48px", color: "#fff" }} />
                <div>
                  <Title level={2} style={{ margin: 0, color: "#fff" }}>
                    热门投票
                  </Title>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                    正在进行的投票活动
                  </Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Row gutter={48}>
                <Col>
                  <Statistic
                    title={<span style={{ color: "rgba(255,255,255,0.85)" }}>进行中</span>}
                    value={stats.active}
                    suffix="个"
                    valueStyle={{ color: "#fff" }}
                  />
                </Col>
                <Col>
                  <Statistic
                    title={<span style={{ color: "rgba(255,255,255,0.85)" }}>总投票数</span>}
                    value={stats.total}
                    suffix="个"
                    valueStyle={{ color: "#fff" }}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* 投票卡片列表 */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : hotVotes.length === 0 ? (
          <Card 
            bordered={false}
            style={{ 
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            <Empty 
              description="暂无进行中的投票活动" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {hotVotes.map((vote) => (
              <Col xs={24} sm={12} lg={8} key={vote.id}>
                <Card
                  hoverable
                  bordered={false}
                  style={{ 
                    height: "100%",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "all 0.3s ease"
                  }}
                  bodyStyle={{ padding: "24px" }}
                  actions={[
                    <Button 
                      type="primary" 
                      icon={<EyeOutlined />}
                      onClick={() => handleViewVote(vote)}
                      key="view"
                    >
                      查看详情
                    </Button>
                  ]}
                >
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    {/* 投票标题和类型 */}
                    <div>
                      <Space size={8} style={{ marginBottom: "8px" }}>
                        <Tag color={voteTypeColor(vote.voteType)}>
                          {voteTypeLabel(vote.voteType)}
                        </Tag>
                        <Tag icon={<CheckCircleOutlined />} color="success">
                          进行中
                        </Tag>
                      </Space>
                      <Title level={4} style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
                        {vote.title}
                      </Title>
                    </div>

                    {/* 投票信息 */}
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary">
                          <TeamOutlined /> 党组织
                        </Text>
                        <Text strong ellipsis style={{ maxWidth: "60%" }}>
                          {vote.partyOrgName}
                        </Text>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary">
                          <TrophyOutlined /> 最多可选
                        </Text>
                        <Text strong>{vote.maxChoices} 项</Text>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary">选项数量</Text>
                        <Text strong>{vote.options.length} 个</Text>
                      </div>
                    </Space>

                    {/* 时间信息 */}
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary">
                          <ClockCircleOutlined /> 开始时间
                        </Text>
                        <Text>{formatTimestamp(vote.startTime)}</Text>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text type="secondary">
                          <ClockCircleOutlined /> 结束时间
                        </Text>
                        <Text>{formatTimestamp(vote.endTime)}</Text>
                      </div>
                    </Space>

                    {/* 进度条 */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <Text type="secondary">投票进度</Text>
                        <Text strong style={{ color: "#1890ff" }}>
                          {getTimeRemaining(vote.endTime)}
                        </Text>
                      </div>
                      <Progress 
                        percent={getVoteProgress(vote.endTime, vote.startTime)} 
                        strokeColor={{
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        }}
                        status="active"
                      />
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Space>

      {/* 投票详情模态框 */}
      <Modal
        title={
          <Space>
            <FireOutlined style={{ color: "#1890ff" }} />
            <span>投票详情</span>
          </Space>
        }
        open={detailModalVisible}
        onCancel={handleCloseDetail}
        footer={[
          <Button key="close" onClick={handleCloseDetail}>
            关闭
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
      >
        {loadingDetail ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Spin size="large" />
          </div>
        ) : selectedVote ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {/* 投票标题和状态 */}
            <div>
              <Title level={4} style={{ margin: 0, marginBottom: "8px" }}>
                {selectedVote.title}
              </Title>
              <Space size={8}>
                <Tag color={voteTypeColor(selectedVote.voteType)}>
                  {voteTypeLabel(selectedVote.voteType)}
                </Tag>
                <Tag icon={<CheckCircleOutlined />} color="success">
                  进行中
                </Tag>
              </Space>
            </div>

            <Divider style={{ margin: "8px 0" }} />

            {/* 基本信息 */}
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="投票ID" span={2}>
                <Text code>{selectedVote.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="党组织" span={2}>
                <Text strong>{selectedVote.partyOrgName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="组织地址" span={2}>
                <Text code style={{ fontSize: "12px" }}>{selectedVote.partyOrg}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="投票类型">
                {voteTypeLabel(selectedVote.voteType)}
              </Descriptions.Item>
              <Descriptions.Item label="最多可选">
                <Text strong>{selectedVote.maxChoices} 项</Text>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {formatTimestamp(selectedVote.startTime)}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {formatTimestamp(selectedVote.endTime)}
              </Descriptions.Item>
              <Descriptions.Item label="剩余时间" span={2}>
                <Text strong style={{ color: "#1890ff" }}>
                  {getTimeRemaining(selectedVote.endTime)}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            {/* 投票进度 */}
            <div>
              <Text type="secondary" style={{ marginBottom: "8px", display: "block" }}>
                投票进度
              </Text>
              <Progress 
                percent={getVoteProgress(selectedVote.endTime, selectedVote.startTime)} 
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
                status="active"
              />
            </div>

            <Divider style={{ margin: "8px 0" }} />

            {/* 投票选项 */}
            <div>
              <Text strong style={{ fontSize: "16px", marginBottom: "12px", display: "block" }}>
                投票选项（共 {selectedVote.options.length} 个）
              </Text>
              <List
                size="small"
                bordered
                dataSource={selectedVote.options}
                renderItem={(option, index) => (
                  <List.Item>
                    <Space>
                      <Tag color="blue">选项 {index}</Tag>
                      <Text>{option}</Text>
                    </Space>
                  </List.Item>
                )}
                style={{ maxHeight: "300px", overflow: "auto" }}
              />
            </div>
          </Space>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Modal>
    </div>
  );
}
