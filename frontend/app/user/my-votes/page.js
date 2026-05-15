"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Empty, Pagination, Row, Space, Tag, Typography, message } from "antd";
import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";

import { UserLayout } from "@/components";
import { myVoteRecords } from "@/services/voteRecords";

const { Title, Text } = Typography;

function shortHash(h) {
  if (!h) return "-";
  if (h.length <= 16) return h;
  return h.slice(0, 10) + "..." + h.slice(-6);
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

// 投票类型标签
function voteTypeLabel(v) {
  if (v === "ELECTION") return "差额选举";
  if (v === "RESOLUTION") return "决议表决";
  if (v === "EVALUATION") return "评议评价";
  return String(v || "-");
}

export default function UserMyVotesPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // 获取当前用户钱包地址
  const userAddress = useMemo(() => {
    try {
      return localStorage.getItem("wallet_address") || "";
    } catch (e) {
      return "";
    }
  }, []);

  // 获取投票记录列表
  async function fetchList(next) {
    try {
      if (!userAddress) {
        message.error("请先连接钱包登录");
        return;
      }

      setLoading(true);
      var params = next || { page, pageSize };

      var res = await myVoteRecords({ user_address: userAddress, page: params.page, pageSize: params.pageSize });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  // 将投票记录转换为表格行数据
  const rows = useMemo(() => {
    return (items || []).map((it) => ({ key: it.record_id, ...it }));
  }, [items]);

  // 投票状态标签
  function voteStatusTag(status) {
    if (status === 1) return <Tag color="blue">投票已开启</Tag>;
    if (status === 2) return <Tag color="default">投票已关闭</Tag>;
    return <Tag color="gold">投票未开启</Tag>;
  }

  // 提取选择的选项文本（注意：为保护投票隐私，系统不记录具体选择）
  function pickSelectedTexts(row) {
    // 投票选择是保密的，使用零知识证明技术保护隐私
    return "（投票内容保密）";
  }

  return (
    <UserLayout>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              我的投票
            </Title>
            <Text type="secondary">按当前钱包地址查看你提交过的投票记录。</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>

        <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
          {rows && rows.length ? (
            <Row gutter={[16, 16]}>
              {rows.map((row) => (
                <Col key={row.record_id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    style={{ borderRadius: 12, overflow: "hidden" }}
                    styles={{ body: { padding: 0 } }}
                    onClick={() => router.push(`/user/my-votes/${row.record_id}`)}
                  >
                    <div
                      style={{
                        height: 80,
                        background: "linear-gradient(135deg, #e6f4ff 0%, #f6ffed 60%, #fffbe6 100%)",
                        position: "relative",
                      }}
                    >
                      <div style={{ position: "absolute", left: 12, top: 10 }}>{voteStatusTag(row.status)}</div>
                    </div>
                    <div style={{ padding: 12 }}>
                      <Space direction="vertical" size={6} style={{ width: "100%" }}>
                        <Text strong style={{ fontSize: 16 }}>
                          {row.vote_title || `投票 #${row.vote_id}`}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          类型：{voteTypeLabel(row.vote_type)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          党组织：{row.org_name || "-"}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          负责人：{row.leader_name || "-"}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          选择：{pickSelectedTexts(row)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          投票时间：{formatUnixSeconds(row.block_timestamp)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          交易：<Text code>{shortHash(row.tx_hash)}</Text>
                        </Text>
                      </Space>
                    </div>

                    <div style={{ padding: 12, paddingTop: 0 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button
                          type="primary"
                          icon={<EyeOutlined />}
                          onClick={(e) => {
                            if (e && e.stopPropagation) e.stopPropagation();
                            router.push(`/user/my-votes/${row.record_id}`);
                          }}
                        >
                          查看详情
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ padding: 24 }}>
              <Empty description={loading ? "加载中" : "暂无投票记录"} />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              onChange={(p, ps) => {
                setPage(p);
                if (ps !== pageSize) setPageSize(ps);
              }}
            />
          </div>
        </Card>
      </Space>
    </UserLayout>
  );
}
