import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Descriptions,
  Space,
  Table,
  Tag,
  Typography,
  Spin,
  Empty,
  message,
  Row,
  Col,
} from "antd";
import { LeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { ethers } from "ethers";
import { Column } from "@ant-design/plots";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { getFrontendEnv } from "@/lib/env";
import { getVoteDetail } from "@/services/voteAction";

const { Title, Text } = Typography;

// 格式化Unix时间戳
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

// 格式化日期时间
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

// 缩短地址显示
function shortAddress(addr) {
  if (!addr) return "";
  try {
    var a = ethers.getAddress(addr);
    return a.slice(0, 10) + "..." + a.slice(-8);
  } catch (e) {
    return addr;
  }
}

// 投票状态标签
function voteStatusTag(v) {
  var s = parseInt(String(v ?? "0"), 10);
  if (s === 1) return <Tag color="blue">投票已开启</Tag>;
  if (s === 2) return <Tag color="green">投票已关闭</Tag>;
  return <Tag color="default">投票未开启</Tag>;
}

// 投票类型标签
function voteTypeLabel(v) {
  if (v === 0 || v === "0" || String(v).toUpperCase() === "ELECTION") return "差额选举";
  if (v === 1 || v === "1" || String(v).toUpperCase() === "RESOLUTION") return "决议表决";
  if (v === 2 || v === "2" || String(v).toUpperCase() === "EVALUATION") return "评议评价";
  return String(v || "-");
}

export function VoteResultDetail({ voteId }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [voteDetail, setVoteDetail] = useState(null);
  const [voteResult, setVoteResult] = useState(null);
  const [voterList, setVoterList] = useState([]);
  const [chartData, setChartData] = useState([]);

  // 获取投票详情（从数据库）
  async function fetchVoteDetail() {
    try {
      var data = await getVoteDetail(voteId);
      setVoteDetail(data);
    } catch (e) {
      console.error("获取投票详情失败:", e);
      message.error(e.message || "获取投票详情失败");
    }
  }

  // 获取投票结果（从合约）
  async function fetchVoteResult() {
    if (!voteDetail || !voteDetail.chain_vote_id) return;

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

      var chainVoteId = BigInt(voteDetail.chain_vote_id);

      // 调用合约获取投票结果
      var result = await contract.getVoteResult(chainVoteId);

      var resultData = {
        title: result[0],
        voteType: Number(result[1]),
        options: result[2],
        voteCounts: result[3].map((count) => Number(count)),
        totalVotes: Number(result[4]),
        partyOrg: result[5],
      };

      setVoteResult(resultData);

      // 准备柱状图数据
      var data = resultData.options.map((option, index) => ({
        选项: option,
        得票数: resultData.voteCounts[index] || 0,
      }));
      setChartData(data);

      // 获取投票者列表（通过Voted事件）
      await fetchVoterList(provider, contract, chainVoteId);
    } catch (e) {
      console.error("获取投票结果失败:", e);
      message.error(e.message || "获取投票结果失败");
    } finally {
      setLoading(false);
    }
  }

  // 获取投票者列表（通过Voted事件）
  async function fetchVoterList(provider, contract, chainVoteId) {
    try {
      var filter = contract.filters.Voted();

      var currentBlock = await provider.getBlockNumber();

      var events = [];
      try {
        events = await contract.queryFilter(filter, 0, "latest");
      } catch (queryError) {
        // 如果查询失败，尝试只查询最近的区块
        var startBlock = Math.max(0, currentBlock - 10000);
        events = await contract.queryFilter(filter, startBlock, "latest");
      }

      if (events.length === 0) {
        setVoterList([]);
        return;
      }

      var voters = [];
      for (var i = 0; i < events.length; i++) {
        var event = events[i];

        if (!event.args || !event.args.voteId) {
          continue;
        }

        var eventVoteId = event.args.voteId;
        if (eventVoteId.toString() !== chainVoteId.toString()) {
          continue;
        }

        var block = await provider.getBlock(event.blockNumber);

        voters.push({
          key: voters.length,
          voter: event.args.operator, // 使用 operator 而不是 voter
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Number(event.args.timestamp),
          blockTimestamp: block ? block.timestamp : null,
        });
      }

      setVoterList(voters);
    } catch (e) {
      console.error("获取投票者列表失败:", e);
      setVoterList([]);
    }
  }

  useEffect(() => {
    if (voteId) {
      fetchVoteDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteId]);

  useEffect(() => {
    if (voteDetail) {
      fetchVoteResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteDetail]);

  // 投票者列表表格列定义
  const voterColumns = [
    {
      title: "序号",
      dataIndex: "key",
      key: "key",
      width: 60,
      render: (text) => text + 1,
    },
    {
      title: "投票者地址",
      dataIndex: "voter",
      key: "voter",
      render: (addr) => (
        <Text code copyable>
          {shortAddress(addr)}
        </Text>
      ),
    },
    {
      title: "投票状态",
      key: "status",
      width: 100,
      render: () => <Tag color="green">已投票</Tag>,
    },
    {
      title: "区块号",
      dataIndex: "blockNumber",
      key: "blockNumber",
      width: 100,
    },
    {
      title: "交易哈希",
      dataIndex: "transactionHash",
      key: "transactionHash",
      render: (hash) => (
        <Text code copyable>
          {hash ? hash.slice(0, 10) + "..." + hash.slice(-8) : "-"}
        </Text>
      ),
    },
    {
      title: "投票时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 180,
      render: (ts) => formatUnixSeconds(ts),
    },
  ];

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
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space>
        <Button icon={<LeftOutlined />} onClick={() => router.push("/partyorg/history")}>
          返回投票历史
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchVoteResult} loading={loading}>
          刷新结果
        </Button>
      </Space>

      {loading && !voteResult ? (
        <Card style={{ borderRadius: 12 }}>
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" tip="加载投票结果中..." />
          </div>
        </Card>
      ) : !voteDetail ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty description="未找到投票信息" />
        </Card>
      ) : (
        <>
          {/* 投票基本信息 */}
          <Card title="投票基本信息" style={{ borderRadius: 12 }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="投票标题" span={2}>
                {voteDetail.vote_title}
              </Descriptions.Item>
              <Descriptions.Item label="投票类型">{voteTypeLabel(voteDetail.vote_type)}</Descriptions.Item>
              <Descriptions.Item label="投票状态">{voteStatusTag(voteDetail.status)}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatDateTime(voteDetail.start_time)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{formatDateTime(voteDetail.end_time)}</Descriptions.Item>
              <Descriptions.Item label="最多可选">{voteDetail.max_choices}</Descriptions.Item>
              <Descriptions.Item label="总投票数">
                {voteResult ? voteResult.totalVotes : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="党组织名称" span={2}>
                {voteDetail.org_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="投票说明" span={2}>
                {voteDetail.description || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 投票结果柱状图 */}
          {voteResult && (
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
                            background: count === Math.max(...voteResult.voteCounts) && count > 0 ? "#f6ffed" : "#fafafa",
                            borderColor: count === Math.max(...voteResult.voteCounts) && count > 0 ? "#52c41a" : "#d9d9d9",
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
          )}

          {/* 投票者列表 */}
          <Card title={`投票者列表 (${voterList.length})`} style={{ borderRadius: 12 }}>
            {voterList.length === 0 ? (
              <Empty description="该投票暂无投票记录" />
            ) : (
              <Table
                columns={voterColumns}
                dataSource={voterList}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                scroll={{ x: 800 }}
              />
            )}
          </Card>
        </>
      )}
    </Space>
  );
}
