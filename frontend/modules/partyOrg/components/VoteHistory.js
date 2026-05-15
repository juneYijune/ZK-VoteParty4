import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined, BarChartOutlined } from "@ant-design/icons";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";

import { listVoteActions } from "@/services/voteAction";
import { listPartyOrgs } from "@/services/partyOrgs";

const { Title, Text } = Typography;

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

// 投票类型标签
function voteTypeLabel(v) {
  if (v === 0 || v === "0" || String(v).toUpperCase() === "ELECTION") return "差额选举";
  if (v === 1 || v === "1" || String(v).toUpperCase() === "RESOLUTION") return "决议表决";
  if (v === 2 || v === "2" || String(v).toUpperCase() === "EVALUATION") return "评议评价";
  return String(v || "-");
}

// 投票状态标签
function voteStatusTag(v) {
  var s = parseInt(String(v ?? "0"), 10);
  if (s === 1) return <Tag color="blue">投票已开启</Tag>;
  if (s === 2) return <Tag color="green">投票已关闭</Tag>;
  return <Tag color="default">投票未开启</Tag>;
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

export function VoteHistory() {
  const router = useRouter();
  
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [walletAddress, setWalletAddress] = useState("");
  const [myPartyOrgId, setMyPartyOrgId] = useState(null);

  // 获取投票列表
  async function fetchList(next) {
    try {
      setLoading(true);

      var params = next || { keyword, status, page, pageSize, party_org_id: myPartyOrgId };
      var s = params.status;
      if (s === "all") s = "";

      if (!params.party_org_id) {
        setItems([]);
        setTotal(0);
        return;
      }

      var res = await listVoteActions({
        keyword: params.keyword,
        status: s,
        party_org_id: params.party_org_id,
        page: params.page,
        pageSize: params.pageSize,
      });

      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载投票列表失败");
    } finally {
      setLoading(false);
    }
  }

  // 获取党组织信息
  async function fetchPartyOrgInfo(addr) {
    try {
      var res = await listPartyOrgs({ keyword: addr || "", page: 1, pageSize: 20 });
      var list = (res && res.items) || [];

      if (addr && list.length >= 1) {
        setMyPartyOrgId(list[0].org_id);
      }
    } catch (e) {
      setMyPartyOrgId(null);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, myPartyOrgId]);

  useEffect(() => {
    try {
      const addr = localStorage.getItem("wallet_address") || "";
      setWalletAddress(addr);
      if (addr) fetchPartyOrgInfo(addr);
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 搜索
  async function handleSearch() {
    setPage(1);
    await fetchList({ keyword, status, page: 1, pageSize, party_org_id: myPartyOrgId });
  }

  // 查看投票结果
  function handleViewResult(vote) {
    router.push(`/partyorg/history/${vote.vote_id}`);
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            投票历史
          </Title>
          <Text type="secondary">
            党组织管理员：{walletAddress ? shortAddress(walletAddress) : "未连接钱包"}
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              allowClear
              placeholder="按标题/类型搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>

          <Col xs={24} md={6}>
            <Select
              value={status}
              style={{ width: "100%" }}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "全部状态" },
                { value: "0", label: "投票未开启" },
                { value: "1", label: "投票已开启" },
                { value: "2", label: "投票已关闭" },
              ]}
            />
          </Col>

          <Col xs={24} md={8} style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleSearch}>搜索</Button>
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          {items.length === 0 && !loading ? (
            <Empty description="暂无投票历史" />
          ) : (
            <Row gutter={[12, 12]}>
              {items.map((it) => (
                <Col key={String(it.vote_id)} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    style={{ borderRadius: 12, overflow: "hidden" }}
                    styles={{ body: { padding: 0 } }}
                    loading={loading}
                  >
                    <div
                      style={{
                        height: 80,
                        background: "linear-gradient(135deg, #e6f4ff 0%, #f6ffed 60%, #fffbe6 100%)",
                        position: "relative",
                      }}
                    >
                      <div style={{ position: "absolute", left: 12, top: 10 }}>{voteStatusTag(it.status)}</div>
                    </div>
                    <div style={{ padding: 12 }}>
                      <Space direction="vertical" size={6} style={{ width: "100%" }}>
                        <Text strong style={{ fontSize: 16 }}>
                          {it.vote_title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          类型：{voteTypeLabel(it.vote_type)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          党组织：{it.org_name || "-"}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          开始：{formatDateTime(it.start_time)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          结束：{formatDateTime(it.end_time)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          最多可选：{it.max_choices}
                        </Text>
                      </Space>
                    </div>

                    <div style={{ padding: 12, paddingTop: 0 }}>
                      <Button
                        type="primary"
                        icon={<BarChartOutlined />}
                        block
                        onClick={() => handleViewResult(it)}
                      >
                        查看投票结果
                      </Button>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        </div>
      </Card>
    </Space>
  );
}
