"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Button, 
  Card, 
  Col, 
  Empty, 
  Input, 
  Pagination, 
  Row, 
  Space, 
  Tag, 
  Typography, 
  message,
  Progress,
  Statistic,
  Divider,
  Badge,
} from "antd";
import { 
  EyeOutlined, 
  ReloadOutlined, 
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  TeamOutlined,
  TrophyOutlined,
  CalendarOutlined,
  SafetyOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { UserLayout } from "@/components";
import { listVoteActions } from "@/services/voteAction";
import { useWallet } from "@/hooks";
import { getAllVerifications } from "@/utils/zkVerificationStorage";
import { EligibilityVerificationDialog } from "@/modules/user/components/EligibilityVerificationDialog";

const { Title, Text } = Typography;

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
  return dayjs(d).format("YYYY-MM-DD HH:mm");
}

// 投票类型映射
function voteTypeLabel(v) {
  if (v === "ELECTION") return "差额选举";
  if (v === "RESOLUTION") return "决议表决";
  if (v === "EVALUATION") return "评议评价";
  return String(v || "-");
}

// 投票类型颜色
function voteTypeColor(v) {
  if (v === "ELECTION") return "blue";
  if (v === "RESOLUTION") return "green";
  if (v === "EVALUATION") return "orange";
  return "default";
}

// 投票状态标签
function voteStatusTag(status, startTime, endTime) {
  var now = new Date();
  var start = startTime ? new Date(startTime) : null;
  var end = endTime ? new Date(endTime) : null;

  if (status === 2 || (end && now > end)) {
    return <Tag icon={<StopOutlined />} color="default">投票已关闭</Tag>;
  }
  if (status === 1 && start && end && now >= start && now <= end) {
    return <Tag icon={<CheckCircleOutlined />} color="success">投票已开启</Tag>;
  }
  return <Tag icon={<ClockCircleOutlined />} color="warning">投票未开启</Tag>;
}

// 计算剩余时间
function getTimeRemaining(endTime) {
  if (!endTime) return "未知";
  var now = new Date();
  var end = new Date(endTime);
  var remaining = Math.floor((end - now) / 1000);
  
  if (remaining <= 0) return "已结束";
  
  var days = Math.floor(remaining / 86400);
  var hours = Math.floor((remaining % 86400) / 3600);
  var minutes = Math.floor((remaining % 3600) / 60);
  
  if (days > 0) return `剩余 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `剩余 ${hours} 小时 ${minutes} 分钟`;
  return `剩余 ${minutes} 分钟`;
}

// 计算投票进度
function getVoteProgress(endTime, startTime, status) {
  if (!endTime || !startTime) return 0;
  var now = new Date();
  var start = new Date(startTime);
  var end = new Date(endTime);
  var total = end - start;
  var elapsed = now - start;
  
  if (elapsed <= 0) return 0;
  // 如果投票已结束（status === 2）或时间已过，显示 100%
  if (status === 2 || elapsed >= total) return 100;
  
  return Math.floor((elapsed / total) * 100);
}

// 渲染验证状态标识
function renderVerificationBadge(voteId, verificationStatuses) {
  const verification = verificationStatuses[voteId];
  
  if (!verification) {
    // 未验证
    return (
      <Tag icon={<QuestionCircleOutlined />} color="default">
        未验证
      </Tag>
    );
  }
  
  if (verification.is_verified) {
    // 已验证且通过
    return (
      <Tag icon={<SafetyOutlined />} color="success">
        已验证
      </Tag>
    );
  } else {
    // 已验证但未通过
    return (
      <Tag icon={<CloseCircleOutlined />} color="error">
        不符合资格
      </Tag>
    );
  }
}

export default function UserVotesPage() {
  const router = useRouter();
  const { account } = useWallet();

  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  
  // 验证状态映射：vote_id -> verification record
  const [verificationStatuses, setVerificationStatuses] = useState({});
  
  // 验证对话框状态
  const [verificationDialogVisible, setVerificationDialogVisible] = useState(false);
  const [currentVote, setCurrentVote] = useState(null);

  async function fetchList(next) {
    try {
      setLoading(true);
      var params = next || { keyword, page, pageSize };

      var res = await listVoteActions({
        keyword: params.keyword,
        page: params.page,
        pageSize: params.pageSize,
      });

      setItems(res.items || []);
      setTotal(res.total || 0);
      
      // 加载验证状态
      loadVerificationStatuses();
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }
  
  // 从localStorage加载验证状态
  function loadVerificationStatuses() {
    if (!account) {
      setVerificationStatuses({});
      return;
    }
    
    try {
      const allVerifications = getAllVerifications(account);
      setVerificationStatuses(allVerifications || {});
    } catch (error) {
      console.error('加载验证状态失败:', error);
      setVerificationStatuses({});
    }
  }
  
  // 当钱包地址变化时，重新加载验证状态
  useEffect(() => {
    if (account) {
      loadVerificationStatuses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  async function handleSearch() {
    setPage(1);
    await fetchList({ keyword, page: 1, pageSize });
  }
  
  // 处理投票卡片点击
  function handleVoteClick(vote) {
    if (!account) {
      message.warning("请先连接钱包");
      return;
    }
    
    const verification = verificationStatuses[vote.vote_id];
    
    if (!verification) {
      // 未验证：弹出验证对话框
      setCurrentVote(vote);
      setVerificationDialogVisible(true);
    } else if (verification.is_verified) {
      // 已验证通过：允许进入详情
      router.push(`/user/votes/${vote.vote_id}`);
    } else {
      // 已验证未通过：显示错误信息
      message.error("您不满足该投票的资格要求，无法查看详情");
    }
  }
  
  // 验证完成回调
  function handleVerificationComplete(success) {
    // 重新加载验证状态
    loadVerificationStatuses();
    
    if (success && currentVote) {
      // 验证成功，跳转到投票详情
      message.success("验证成功！正在跳转到投票详情...");
      setTimeout(() => {
        router.push(`/user/votes/${currentVote.vote_id}`);
      }, 1000);
    } else if (!success) {
      // 验证失败
      message.error("您不满足该投票的资格要求");
    }
  }
  
  // 关闭验证对话框
  function handleCloseVerificationDialog() {
    setVerificationDialogVisible(false);
    setCurrentVote(null);
  }

  const rows = useMemo(() => {
    return (items || []).map((it) => ({ key: it.vote_id, ...it }));
  }, [items]);

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
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            }}
          >
            <Row gutter={24} align="middle">
              <Col flex="auto">
                <Space align="center" size={16}>
                  <CalendarOutlined style={{ fontSize: "48px", color: "#fff" }} />
                  <div>
                    <Title level={2} style={{ margin: 0, color: "#fff" }}>
                      投票列表
                    </Title>
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
                      浏览投票，进入详情后可进行投票
                    </Text>
                  </div>
                </Space>
              </Col>
              <Col>
                <Statistic
                  title={<span style={{ color: "rgba(255,255,255,0.85)" }}>投票总数</span>}
                  value={total}
                  suffix="个"
                  valueStyle={{ color: "#fff" }}
                />
              </Col>
            </Row>
          </Card>

          {/* 搜索栏 */}
          <Card 
            bordered={false}
            style={{ 
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
              <Space>
                <Input
                  allowClear
                  placeholder="搜索投票标题、类型或党组织名称"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 300 }}
                />
                <Button icon={<SearchOutlined />} type="primary" onClick={handleSearch}>
                  搜索
                </Button>
              </Space>
              <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
                刷新
              </Button>
            </Space>
          </Card>

          {/* 投票卡片列表 */}
          {rows && rows.length ? (
            <Row gutter={[16, 16]}>
              {rows.map((row) => {
                return (
                  <Col key={row.vote_id} xs={24} sm={12} lg={8} xl={6}>
                    <Card
                      hoverable
                      bordered={false}
                      style={{ 
                        height: "100%",
                        borderRadius: "8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        transition: "all 0.3s ease"
                      }}
                      bodyStyle={{ padding: "20px" }}
                      actions={[
                        <Button 
                          type="primary" 
                          icon={<EyeOutlined />}
                          onClick={() => handleVoteClick(row)}
                          key="view"
                        >
                          查看详情
                        </Button>
                      ]}
                    >
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {/* 投票标题和类型 */}
                        <div>
                          <Space size={8} style={{ marginBottom: "8px" }} wrap>
                            <Tag color={voteTypeColor(row.vote_type)}>
                              {voteTypeLabel(row.vote_type)}
                            </Tag>
                            {voteStatusTag(row.status, row.start_time, row.end_time)}
                            {renderVerificationBadge(row.vote_id, verificationStatuses)}
                          </Space>
                          <Title level={5} style={{ margin: 0 }} ellipsis={{ rows: 2 }}>
                            {row.vote_title}
                          </Title>
                        </div>

                        <Divider style={{ margin: "8px 0" }} />

                        {/* 投票信息 */}
                        <Space direction="vertical" size={6} style={{ width: "100%" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary">
                              <TeamOutlined /> 党组织
                            </Text>
                            <Text strong ellipsis style={{ maxWidth: "60%" }}>
                              {row.org_name || "-"}
                            </Text>
                          </div>
                          
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary">
                              <TrophyOutlined /> 最多可选
                            </Text>
                            <Text strong>{row.max_choices} 项</Text>
                          </div>
                          
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary">负责人</Text>
                            <Text>{row.leader_name || "-"}</Text>
                          </div>
                        </Space>

                        <Divider style={{ margin: "8px 0" }} />

                        {/* 时间信息 */}
                        <Space direction="vertical" size={6} style={{ width: "100%" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary" style={{ fontSize: "12px" }}>
                              <ClockCircleOutlined /> 开始
                            </Text>
                            <Text style={{ fontSize: "12px" }}>{formatDateTime(row.start_time)}</Text>
                          </div>
                          
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Text type="secondary" style={{ fontSize: "12px" }}>
                              <ClockCircleOutlined /> 结束
                            </Text>
                            <Text style={{ fontSize: "12px" }}>{formatDateTime(row.end_time)}</Text>
                          </div>
                        </Space>

                        {/* 进度条 - 投票已开启或已关闭时显示 */}
                        {(row.status === 1 || row.status === 2) && (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <Text type="secondary" style={{ fontSize: "12px" }}>投票进度</Text>
                              <Text strong style={{ color: row.status === 2 ? "#52c41a" : "#1890ff", fontSize: "12px" }}>
                                {getTimeRemaining(row.end_time)}
                              </Text>
                            </div>
                            <Progress 
                              percent={getVoteProgress(row.end_time, row.start_time, row.status)} 
                              strokeColor={{
                                '0%': '#108ee9',
                                '100%': '#87d068',
                              }}
                              status={row.status === 2 ? "success" : "active"}
                              size="small"
                            />
                          </div>
                        )}
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Card 
              bordered={false}
              style={{ 
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
            >
              <Empty 
                description={loading ? "加载中..." : "暂无投票"} 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          )}

          {/* 分页 */}
          {rows && rows.length > 0 && (
            <Card 
              bordered={false}
              style={{ 
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  showTotal={(total) => `共 ${total} 条`}
                  onChange={(p, ps) => {
                    setPage(p);
                    if (ps !== pageSize) setPageSize(ps);
                  }}
                />
              </div>
            </Card>
          )}
        </Space>
      </div>
      
      {/* 资格验证对话框 */}
      {currentVote && (
        <EligibilityVerificationDialog
          visible={verificationDialogVisible}
          voteId={currentVote.vote_id}
          eligibilityRule={currentVote.eligibility_rule}
          walletAddress={account}
          onVerificationComplete={handleVerificationComplete}
          onClose={handleCloseVerificationDialog}
        />
      )}
    </UserLayout>
  );
}
