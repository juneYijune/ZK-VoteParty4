import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { Column } from "@ant-design/plots";
import { Pie } from "@ant-design/plots";
import dayjs from "dayjs";

import { listSystemLogs, getLogStatistics } from "@/services/systemLogs";

const { RangePicker } = DatePicker;
const { Text } = Typography;

// 日志类型映射
const LOG_TYPE_MAP = {
  PARTY_ORG_ADD: { label: "添加党组织", color: "green" },
  PARTY_ORG_REMOVE: { label: "撤销党组织", color: "red" },
  VOTE_CREATE: { label: "创建投票", color: "blue" },
  VOTE_CAST: { label: "党员投票", color: "purple" },
  START_VOTE: { label: "开始投票", color: "cyan" },
  END_VOTE: { label: "结束投票", color: "orange" },
};

function shortAddress(addr) {
  if (!addr) return "-";
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatDateTime(v) {
  if (!v) return "-";
  var d = null;

  if (v instanceof Date) {
    d = v;
  } else if (typeof v === "number") {
    d = new Date(v * 1000);
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

export function AuditLogs() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [logType, setLogType] = useState("all");
  const [operatorAddress, setOperatorAddress] = useState("");
  const [dateRange, setDateRange] = useState(null);

  const [statistics, setStatistics] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("list");

  // 趋势图数据
  const [trendData, setTrendData] = useState([]);
  // 饼图数据
  const [pieData, setPieData] = useState([]);

  // 获取日志列表
  async function fetchLogs() {
    try {
      setLoading(true);

      var params = {
        page: page,
        pageSize: pageSize,
        log_type: logType,
        operator_address: operatorAddress,
      };

      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format("YYYY-MM-DD HH:mm:ss");
        params.end_date = dateRange[1].format("YYYY-MM-DD HH:mm:ss");
      }

      var res = await listSystemLogs(params);
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载日志失败");
    } finally {
      setLoading(false);
    }
  }

  // 获取统计信息
  async function fetchStatistics() {
    try {
      setStatsLoading(true);
      var res = await getLogStatistics();
      setStatistics(res || {});

      // 准备饼图数据
      var pieChartData = [];
      for (var key in res) {
        if (res[key] > 0) {
          var config = LOG_TYPE_MAP[key] || { label: key, color: "default" };
          pieChartData.push({
            type: config.label,
            value: res[key],
          });
        }
      }
      
      console.log("饼图数据:", pieChartData); // 调试日志
      setPieData(pieChartData);
    } catch (e) {
      console.error("获取统计信息失败:", e);
    } finally {
      setStatsLoading(false);
    }
  }

  // 准备趋势图数据
  function prepareTrendData(logs) {
    // 按日期和类型分组统计
    var dateMap = {};

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      var date = formatDateTime(log.block_timestamp).split(" ")[0]; // 只取日期部分
      var type = LOG_TYPE_MAP[log.log_type]?.label || log.log_type;

      if (!dateMap[date]) {
        dateMap[date] = {};
      }
      if (!dateMap[date][type]) {
        dateMap[date][type] = 0;
      }
      dateMap[date][type]++;
    }

    // 转换为图表数据格式
    var chartData = [];
    for (var d in dateMap) {
      for (var t in dateMap[d]) {
        chartData.push({
          日期: d,
          类型: t,
          数量: dateMap[d][t],
        });
      }
    }

    // 按日期排序
    chartData.sort((a, b) => (a.日期 > b.日期 ? 1 : -1));

    setTrendData(chartData);
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    // 当日志数据变化时，更新趋势图
    if (items.length > 0) {
      prepareTrendData(items);
    }
  }, [items]);

  function handleSearch() {
    setPage(1);
    fetchLogs();
  }

  function handleReset() {
    setLogType("all");
    setOperatorAddress("");
    setDateRange(null);
    setPage(1);
    setTimeout(() => {
      fetchLogs();
    }, 100);
  }

  const columns = [
    {
      title: "日志类型",
      dataIndex: "log_type",
      key: "log_type",
      width: 120,
      render: (type) => {
        var config = LOG_TYPE_MAP[type] || { label: type, color: "default" };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "操作描述",
      dataIndex: "action_desc",
      key: "action_desc",
      ellipsis: true,
    },
    {
      title: "操作人地址",
      dataIndex: "operator_address",
      key: "operator_address",
      width: 140,
      render: (addr) => <Text code>{shortAddress(addr)}</Text>,
    },
    {
      title: "目标地址",
      dataIndex: "target_address",
      key: "target_address",
      width: 140,
      render: (addr) => (addr ? <Text code>{shortAddress(addr)}</Text> : "-"),
    },
    {
      title: "投票ID",
      dataIndex: "vote_id",
      key: "vote_id",
      width: 80,
      render: (id) => (id ? id : "-"),
    },
    {
      title: "区块高度",
      dataIndex: "block_number",
      key: "block_number",
      width: 100,
    },
    {
      title: "交易哈希",
      dataIndex: "tx_hash",
      key: "tx_hash",
      width: 140,
      render: (hash) => <Text code>{shortAddress(hash)}</Text>,
    },
    {
      title: "操作时间",
      dataIndex: "block_timestamp",
      key: "block_timestamp",
      width: 160,
      render: (ts) => formatDateTime(ts),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={statsLoading}>
            <Statistic
              title="添加党组织"
              value={statistics.PARTY_ORG_ADD || 0}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={statsLoading}>
            <Statistic
              title="撤销党组织"
              value={statistics.PARTY_ORG_REMOVE || 0}
              valueStyle={{ color: "#ff4d4f" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={statsLoading}>
            <Statistic
              title="创建投票"
              value={statistics.VOTE_CREATE || 0}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={statsLoading}>
            <Statistic
              title="党员投票"
              value={statistics.VOTE_CAST || 0}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={statsLoading}>
            <Statistic
              title="开始投票"
              value={statistics.START_VOTE || 0}
              valueStyle={{ color: "#13c2c2" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card loading={statsLoading}>
            <Statistic
              title="结束投票"
              value={statistics.END_VOTE || 0}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 标签页 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "list",
              label: "日志列表",
            },
            {
              key: "chart",
              label: "可视化分析",
            },
          ]}
        />

        {activeTab === "list" ? (
          <>
            {/* 筛选条件 */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="日志类型"
                  value={logType}
                  onChange={setLogType}
                  style={{ width: "100%" }}
                  options={[
                    { value: "all", label: "全部类型" },
                    { value: "PARTY_ORG_ADD", label: "添加党组织" },
                    { value: "PARTY_ORG_REMOVE", label: "撤销党组织" },
                    { value: "VOTE_CREATE", label: "创建投票" },
                    { value: "VOTE_CAST", label: "党员投票" },
                    { value: "START_VOTE", label: "开始投票" },
                    { value: "END_VOTE", label: "结束投票" },
                  ]}
                />
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="操作人地址"
                  value={operatorAddress}
                  onChange={(e) => setOperatorAddress(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8}>
                <RangePicker
                  showTime
                  value={dateRange}
                  onChange={setDateRange}
                  style={{ width: "100%" }}
                  placeholder={["开始时间", "结束时间"]}
                />
              </Col>

              <Col xs={24} sm={12} md={4}>
                <Space>
                  <Button type="primary" onClick={handleSearch}>
                    查询
                  </Button>
                  <Button onClick={handleReset}>重置</Button>
                  <Button icon={<ReloadOutlined />} onClick={fetchLogs} loading={loading}>
                    刷新
                  </Button>
                </Space>
              </Col>
            </Row>

            {/* 日志列表 */}
            <Table
              columns={columns}
              dataSource={items}
              loading={loading}
              rowKey="log_id"
              pagination={false}
              scroll={{ x: 1200 }}
              locale={{
                emptyText: <Empty description="暂无日志记录" />,
              }}
            />

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                showTotal={(total) => `共 ${total} 条`}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </>
        ) : (
          <>
            {/* 可视化图表 */}
            <Row gutter={16}>
              <Col xs={24} lg={16}>
                <Card title="日志活动趋势" style={{ marginBottom: 16 }}>
                  {loading ? (
                    <div style={{ padding: "40px 0", textAlign: "center" }}>加载中...</div>
                  ) : trendData.length > 0 ? (
                    <div style={{ height: 400 }}>
                      <Column
                        data={trendData}
                        xField="日期"
                        yField="数量"
                        seriesField="类型"
                        isGroup={true}
                        columnStyle={{
                          radius: [4, 4, 0, 0],
                        }}
                        label={{
                          position: "top",
                          style: {
                            fill: "#000000",
                            opacity: 0.6,
                          },
                        }}
                        xAxis={{
                          label: {
                            autoRotate: true,
                            autoHide: true,
                          },
                        }}
                        legend={{
                          position: "top-right",
                        }}
                        color={["#52c41a", "#ff4d4f", "#1890ff", "#722ed1", "#13c2c2", "#fa8c16"]}
                      />
                    </div>
                  ) : (
                    <Empty description="暂无数据" style={{ padding: "40px 0" }} />
                  )}
                </Card>
              </Col>

              <Col xs={24} lg={8}>
                <Card title="日志类型分布" style={{ marginBottom: 16 }}>
                  {statsLoading ? (
                    <div style={{ padding: "40px 0", textAlign: "center" }}>加载中...</div>
                  ) : pieData.length > 0 ? (
                    <div style={{ height: 400 }}>
                      <Pie
                        data={pieData}
                        angleField="value"
                        colorField="type"
                        radius={0.9}
                        innerRadius={0.6}
                        label={{
                          type: "inner",
                          offset: "-50%",
                          content: "{percentage}",
                          style: {
                            fontSize: 16,
                            fontWeight: "bold",
                            fill: "#fff",
                            textAlign: "center",
                          },
                        }}
                        interactions={[
                          {
                            type: "element-active",
                          },
                        ]}
                        statistic={{
                          title: {
                            offsetY: -4,
                            content: "总计",
                            style: {
                              fontSize: "14px",
                            },
                          },
                          content: {
                            offsetY: 4,
                            style: {
                              fontSize: "24px",
                              fontWeight: "bold",
                            },
                            content: pieData.reduce((sum, item) => sum + item.value, 0).toString(),
                          },
                        }}
                        legend={{
                          position: "bottom",
                          itemName: {
                            style: {
                              fontSize: 12,
                            },
                          },
                        }}
                        color={["#52c41a", "#ff4d4f", "#1890ff", "#722ed1", "#13c2c2", "#fa8c16"]}
                        autoFit={true}
                      />
                    </div>
                  ) : (
                    <Empty description="暂无数据" style={{ padding: "40px 0" }} />
                  )}
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Card>
    </Space>
  );
}
