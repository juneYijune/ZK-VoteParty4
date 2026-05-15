"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Descriptions, Space, Tag, Typography, message, Empty, Row, Col, Spin } from "antd";
import { LeftOutlined, ReloadOutlined, BarChartOutlined } from "@ant-design/icons";
import { ethers } from "ethers";
import { Column } from "@ant-design/plots";

import { UserLayout } from "@/components";
import { getVoteRecordDetail } from "@/services/voteRecords";
import { PartyVotingContract } from "@/contracts/partyVoting";
import { getFrontendEnv } from "@/lib/env";

const { Title, Text } = Typography;

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

function formatDateTime(v) {
  if (!v) return "-";
  var d = null;

  if (v instanceof Date) {
    d = v;
  } else if (typeof v === "number") {
    d = new Date(v);
  } else if (typeof v === "string") {
    var s = v.trim();
    if (s && !s.includes("T") && s.includes(" ")) s = s.replace(" ", "T");
    d = new Date(s);
  } else {
    return "-";
  }

  if (!d || !Number.isFinite(d.getTime())) return "-";

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

// 投票状态标签
function voteStatusTag(status) {
  if (status === 1) return <Tag color="blue">投票已开启</Tag>;
  if (status === 2) return <Tag color="default">投票已关闭</Tag>;
  return <Tag color="gold">投票未开启</Tag>;
}

// 投票类型标签
function voteTypeLabel(v) {
  if (v === 0 || v === "0" || String(v).toUpperCase() === "ELECTION") return "差额选举";
  if (v === 1 || v === "1" || String(v).toUpperCase() === "RESOLUTION") return "决议表决";
  if (v === 2 || v === "2" || String(v).toUpperCase() === "EVALUATION") return "评议评价";
  return String(v || "-");
}

export default function MyVoteRecordDetailPage() {
  const router = useRouter();
  const params = useParams();
  const recordId = params && params.record_id;

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [voteResult, setVoteResult] = useState(null);
  const [chartData, setChartData] = useState([]);

  // 获取投票记录详情
  async function fetchDetail() {
    try {
      setLoading(true);
      setDetail(null);

      var data = await getVoteRecordDetail(recordId);
      setDetail(data);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  // 获取投票结果（从合约）
  async function fetchVoteResult() {
    if (!detail || !detail.chain_vote_id) {
      message.error("缺少链上投票ID，无法获取投票结果");
      return;
    }

    try {
      setLoadingResult(true);

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

      var chainVoteId = BigInt(detail.chain_vote_id);

      // 调用合约获取投票结果
      var result = await contract.getVoteResult(chainVoteId);

      // 将 Proxy 对象转换为普通数组
      var optionsArray = [];
      var voteCountsArray = [];
      
      try {
        if (result[2]) {
          optionsArray = Array.from(result[2]);
        }
        if (result[3]) {
          voteCountsArray = Array.from(result[3]).map((count) => Number(count));
        }
      } catch (e) {
        console.error("转换数组失败:", e);
      }

      var resultData = {
        title: result[0] || "",
        voteType: Number(result[1]),
        options: optionsArray,
        voteCounts: voteCountsArray,
        totalVotes: Number(result[4]),
        partyOrg: result[5],
      };
      
      // 检查是否有有效数据
      if (!resultData.options || resultData.options.length === 0) {
        message.warning("该投票暂无投票选项数据，可能投票尚未在链上创建或数据同步延迟");
        setLoadingResult(false);
        return;
      }
      
      setVoteResult(resultData);

      // 准备柱状图数据
      var data = resultData.options.map((option, index) => ({
        选项: option,
        得票数: resultData.voteCounts[index] || 0,
      }));
      setChartData(data);

      setShowResult(true);
      message.success("投票结果加载成功");
    } catch (e) {
      console.error("获取投票结果失败:", e);
      message.error(e.message || "获取投票结果失败");
    } finally {
      setLoadingResult(false);
    }
  }

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  // 柱状图配置
  const chartConfig = {
    data: chartData,
    xField: "选项",
    yField: "得票数",
    label: {
      position: "top",
      style: {
        fill: "#000000",
        opacity: 0.6,
      },
    },
    xAxis: {
      label: {
        autoHide: false,
        autoRotate: true,
      },
    },
    meta: {
      选项: {
        alias: "投票选项",
      },
      得票数: {
        alias: "得票数",
      },
    },
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
    color: ({ 选项 }) => {
      // 根据得票数动态设置颜色
      const item = chartData.find((d) => d.选项 === 选项);
      const maxVotes = Math.max(...chartData.map((d) => d.得票数));
      if (item && item.得票数 === maxVotes && maxVotes > 0) {
        return "#52c41a"; // 最高票数用绿色
      }
      return "#1890ff"; // 其他用蓝色
    },
  };

  return (
    <UserLayout>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => router.push("/user/my-votes")}>
            返回我的投票
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchDetail} loading={loading}>
            刷新
          </Button>
          {detail && detail.status === 2 && (
            <Button
              type="primary"
              icon={<BarChartOutlined />}
              onClick={fetchVoteResult}
              loading={loadingResult}
            >
              查看投票结果
            </Button>
          )}
        </Space>

        {detail ? (
          <>
            <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    投票记录详情
                  </Title>
                  <Text type="secondary">查看你的投票记录和链上信息</Text>
                </div>

                <Descriptions bordered column={1} size="middle">
                  <Descriptions.Item label="投票标题">{detail.vote_title || "-"}</Descriptions.Item>
                  <Descriptions.Item label="投票状态">{voteStatusTag(detail.status)}</Descriptions.Item>
                  <Descriptions.Item label="投票类型">{voteTypeLabel(detail.vote_type)}</Descriptions.Item>
                  <Descriptions.Item label="党员地址">
                    <Text code>{detail.user_address}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="选择的选项">
                    <Text type="secondary">（投票内容保密，使用零知识证明保护隐私）</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="投票时间">{formatUnixSeconds(detail.block_timestamp)}</Descriptions.Item>
                  <Descriptions.Item label="交易哈希">
                    <Text code copyable>
                      {detail.tx_hash}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="区块高度">{detail.block_number}</Descriptions.Item>
                  <Descriptions.Item label="系统记录时间">{formatDateTime(detail.created_at)}</Descriptions.Item>
                </Descriptions>
              </Space>
            </Card>

            <Card title="投票信息" style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
              <Descriptions bordered column={2} size="middle">
                <Descriptions.Item label="最多可选" span={2}>
                  {detail.max_choices || 1}
                </Descriptions.Item>
                <Descriptions.Item label="开始时间" span={2}>
                  {formatDateTime(detail.start_time)}
                </Descriptions.Item>
                <Descriptions.Item label="结束时间" span={2}>
                  {formatDateTime(detail.end_time)}
                </Descriptions.Item>
                <Descriptions.Item label="所属党组织" span={2}>
                  {detail.org_name || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="党组织负责人" span={2}>
                  {detail.leader_name || "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {detail.options && detail.options.length > 0 && (
              <Card title="所有投票选项" style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Text type="secondary" style={{ marginBottom: 8, display: "block" }}>
                    💡 为保护投票隐私，系统使用零知识证明技术，您的投票选择完全保密，任何人（包括您自己）都无法查看具体选择了哪些选项。
                  </Text>
                  {detail.options.map((opt) => {
                    return (
                      <div
                        key={opt.option_index}
                        style={{
                          padding: 12,
                          border: "1px solid #f0f0f0",
                          borderRadius: 8,
                          background: "#fafafa",
                        }}
                      >
                        <Text>{opt.option_text}</Text>
                      </div>
                    );
                  })}
                </Space>
              </Card>
            )}

            {/* 投票结果展示区域 */}
            {showResult && voteResult && (
              <>
                {/* 投票结果柱状图 */}
                <Card title="投票结果统计" style={{ borderRadius: 12 }}>
                  <Row gutter={16}>
                    <Col span={24}>
                      {chartData.length > 0 ? (
                        <div style={{ height: 400 }}>
                          <Column {...chartConfig} />
                        </div>
                      ) : (
                        <Empty description="暂无投票数据" />
                      )}
                    </Col>
                  </Row>

                  <div style={{ marginTop: 24 }}>
                    <Title level={5}>详细数据</Title>
                    <Row gutter={[16, 16]}>
                      {voteResult.options.map((option, index) => {
                        var count = voteResult.voteCounts[index] || 0;
                        var percent =
                          voteResult.totalVotes > 0 ? ((count / voteResult.totalVotes) * 100).toFixed(2) : 0;

                        return (
                          <Col key={index} xs={24} sm={12} md={8} lg={6}>
                            <Card
                              size="small"
                              style={{
                                borderRadius: 8,
                                background:
                                  count === Math.max(...voteResult.voteCounts) && count > 0 ? "#f6ffed" : "#fafafa",
                                borderColor:
                                  count === Math.max(...voteResult.voteCounts) && count > 0 ? "#52c41a" : "#d9d9d9",
                              }}
                            >
                              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                                <Text strong>{option}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  得票数：{count}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  占比：{percent}%
                                </Text>
                              </Space>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  </div>
                </Card>
              </>
            )}

            {loadingResult && (
              <Card style={{ borderRadius: 12 }}>
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Spin size="large" tip="加载投票结果中..." />
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card style={{ borderRadius: 12 }}>
            <Empty description={loading ? "加载中..." : "未找到投票记录"} />
          </Card>
        )}
      </Space>
    </UserLayout>
  );
}
