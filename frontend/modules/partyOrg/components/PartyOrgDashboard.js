import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { MinusCircleOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { ethers } from "ethers";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { connectWallet } from "@/services/wallet";
import { addVoteActionDb, listVoteActions, updateVoteActionStatus, getVoteDetail } from "@/services/voteAction";
import { listPartyOrgs } from "@/services/partyOrgs";
import { getFrontendEnv } from "@/lib/env";

const { Title, Text } = Typography;

function shortAddress(addr) {
  if (!addr) return "";
  try {
    var a = ethers.getAddress(addr);
    return a.slice(0, 6) + "..." + a.slice(-4);
  } catch (e) {
    return addr;
  }
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

function formatUnixSeconds(sec) {
  if (sec === undefined || sec === null || sec === "") return "-";
  var s = parseInt(String(sec), 10);
  if (!Number.isFinite(s) || s <= 0) return "-";
  return formatDateTime(new Date(s * 1000));
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

function toUnixSeconds(v) {
  if (!v) return 0;
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  if (typeof v === "number") return Math.floor(v / 1000);
  // DatePicker (dayjs) object
  if (typeof v === "object" && v && typeof v.toDate === "function") {
    var d = v.toDate();
    if (d && Number.isFinite(d.getTime())) return Math.floor(d.getTime() / 1000);
  }
  return 0;
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

function voteTypeLabel(v) {
  if (v === 0 || v === "0" || String(v).toUpperCase() === "ELECTION") return "差额选举";
  if (v === 1 || v === "1" || String(v).toUpperCase() === "RESOLUTION") return "决议表决";
  if (v === 2 || v === "2" || String(v).toUpperCase() === "EVALUATION") return "评议评价";
  return String(v || "-");
}

function voteStatusTag(v) {
  var s = parseInt(String(v ?? "0"), 10);
  if (s === 1) return <Tag color="blue">投票已开启</Tag>;
  if (s === 2) return <Tag color="green">投票已关闭</Tag>;
  return <Tag color="default">投票未开启</Tag>;
}

export function PartyOrgDashboard({ mode }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [walletAddress, setWalletAddress] = useState("");
  const [partyOrgOptions, setPartyOrgOptions] = useState([]);
  const [myPartyOrgId, setMyPartyOrgId] = useState(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  const [openDetail, setOpenDetail] = useState(false);
  const [detail, setDetail] = useState(null);

  const [statusActionLoading, setStatusActionLoading] = useState({});

  async function handleUpdateVoteStatusOnchain(it, nextStatus) {
    try {
      if (!it) return;
      if (nextStatus !== 1 && nextStatus !== 2) return;

      var chainId = it.chain_vote_id;
      if (typeof chainId === "number") chainId = String(chainId);
      if (typeof chainId === "bigint") chainId = chainId.toString();
      chainId = String(chainId || "").trim();
      if (!chainId || !/^[0-9]+$/.test(chainId) || chainId === "0") {
        throw new Error("chain_vote_id 无效，无法调用合约");
      }

      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }
      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      var currentStatus = parseInt(String(it.status ?? "0"), 10);
      if (nextStatus === 1 && currentStatus !== 0) throw new Error("仅投票未开启状态可开启");
      if (nextStatus === 2 && currentStatus !== 1) throw new Error("仅投票已开启状态可关闭");

      var ok = await new Promise((resolve) => {
        Modal.confirm({
          title: nextStatus === 1 ? "确认开启投票？" : "确认关闭投票？",
          content: (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Text type="secondary">
                {nextStatus === 1
                  ? "该操作会调用合约 startVote，将投票状态改为已开启。"
                  : "该操作会调用合约 endVote，将投票状态改为已关闭。"}
              </Text>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="投票标题">{it.vote_title}</Descriptions.Item>
              </Descriptions>
            </Space>
          ),
          okText: "确认",
          cancelText: "取消",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!ok) return;

      setStatusActionLoading((prev) => ({ ...prev, [chainId]: true }));
      await ensureExpectedChain();

      var addr = await connectWallet();
      if (!addr) throw new Error("未获取到钱包地址");
      setWalletAddress(addr);

      var provider = new ethers.BrowserProvider(window.ethereum);
      var signer = await provider.getSigner();

      var code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error("当前网络该地址没有部署合约，请确认网络与合约部署一致");
      }

      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, signer);
      var voteId = BigInt(chainId);

      var tx = nextStatus === 1 ? await contract.startVote(voteId) : await contract.endVote(voteId);
      var receipt = await tx.wait();
      var blockNumber = receipt && receipt.blockNumber;
      var txHash = tx && tx.hash;
      var block = blockNumber ? await provider.getBlock(blockNumber) : null;
      var blockTs = block && block.timestamp;

      await updateVoteActionStatus({
        chain_vote_id: chainId,
        status: nextStatus,
      });

      Modal.success({
        title: nextStatus === 1 ? "投票已开启" : "投票已关闭",
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="交易哈希">
                <Text code>{txHash || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">{blockNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="区块时间">{formatUnixSeconds(blockTs)}</Descriptions.Item>
            </Descriptions>
            <Text type="secondary">链下已同步：votes.status 已更新。</Text>
          </Space>
        ),
      });

      await fetchList();
    } catch (e) {
      console.error(e);
      message.error(getReadableEthersError(e) || "操作失败");
    } finally {
      try {
        var cid = it && String(it.chain_vote_id || "").trim();
        if (cid) {
          setStatusActionLoading((prev) => {
            var next = { ...prev };
            delete next[cid];
            return next;
          });
        }
      } catch (err) {
        // ignore
      }
    }
  }

  function renderVoteStatusAction(it) {
    var s = parseInt(String(it && (it.status ?? "0")), 10);
    var chainId = String(it && it.chain_vote_id ? it.chain_vote_id : "").trim();
    var actionLoading = !!(chainId && statusActionLoading[chainId]);

    if (s === 0 && mode !== "hot") {
      return (
        <Button
          type="link"
          size="small"
          loading={actionLoading}
          onClick={(e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            handleUpdateVoteStatusOnchain(it, 1);
          }}
        >
          投票未开启（点击开启）
        </Button>
      );
    }

    if (s === 1 && mode !== "hot") {
      return (
        <Button
          type="link"
          size="small"
          danger
          loading={actionLoading}
          onClick={(e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            handleUpdateVoteStatusOnchain(it, 2);
          }}
        >
          投票已开启（点击关闭）
        </Button>
      );
    }

    return voteStatusTag(s);
  }

  async function fetchList(next) {
    try {
      setLoading(true);

      var params = next || { keyword, status, page, pageSize, party_org_id: myPartyOrgId };
      var s = params.status;
      if (s === "all") s = "";

      if (mode === "hot") {
        s = "1";
      }

      if (mode === "my") {
        if (!params.party_org_id) {
          setItems([]);
          setTotal(0);
          return;
        }
      }

      var res = await listVoteActions({
        keyword: params.keyword,
        status: s,
        party_org_id: mode === "my" ? params.party_org_id : undefined,
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

  async function fetchPartyOrgChoices(addr) {
    try {
      var res = await listPartyOrgs({ keyword: addr || "", page: 1, pageSize: 20 });
      var list = (res && res.items) || [];
      
      var opts = list.map((it) => ({
        label: `${it.org_name}（编码:${it.org_code || '无'}）`,
        value: it.org_id,
        orger_address: it.orger_address,
        org_code: it.org_code,
      }));
      
      setPartyOrgOptions(opts);

      if (addr && opts.length >= 1) {
        setMyPartyOrgId(opts[0].value);
      }

      if (addr && opts.length === 1) {
        form.setFieldValue("party_org_id", opts[0].value);
        // 自动填充组织编码
        const orgCode = opts[0].org_code || "";
        form.setFieldValue("require_org_code", orgCode);
      }
    } catch (e) {
      console.error('获取党组织列表失败:', e);
      setPartyOrgOptions([]);
      setMyPartyOrgId(null);
    }
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, status, myPartyOrgId, mode]);

  useEffect(() => {
    try {
      const addr = localStorage.getItem("wallet_address") || "";
      setWalletAddress(addr);
      if (addr) fetchPartyOrgChoices(addr);
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "create") {
      setOpenCreate(true);
    }
  }, [mode]);

  const pagedItems = useMemo(() => items, [items]);

  async function handleOpenDetail(it) {
    try {
      if (!it || !it.vote_id) {
        message.error('投票ID无效');
        return;
      }

      // 调用后端 API 获取完整的投票详情
      const detailData = await getVoteDetail(it.vote_id);
      
      // 确保 eligibility_rule 有默认值
      const detailWithDefaults = {
        ...detailData,
        eligibility_rule: detailData.eligibility_rule || {
          require_formal_member: false,
          min_party_years: 0,
          require_org_code: 0,
          require_active_status: false,
          require_fee_paid: false,
          require_no_conflict: false,
        }
      };
      
      setDetail(detailWithDefaults);
      setOpenDetail(true);
    } catch (e) {
      console.error('获取投票详情失败:', e);
      message.error(e.message || '获取投票详情失败');
    }
  }

  async function handleSearch() {
    setPage(1);
    await fetchList({ keyword, status, page: 1, pageSize });
  }

  async function handleCreateSubmit() {
    try {
      const values = await form.validateFields();

      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }
      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      setCreateLoading(true);

      await ensureExpectedChain();

      var addr = await connectWallet();
      if (!addr) throw new Error("未获取到钱包地址");
      setWalletAddress(addr);
      await fetchPartyOrgChoices(addr);

      var provider = new ethers.BrowserProvider(window.ethereum);
      var signer = await provider.getSigner();

      var code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error("当前网络该地址没有部署合约，请确认网络与合约部署一致");
      }

      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, signer);

      var options = (values.options || []).map((it) => String(it.option_text || "").trim()).filter(Boolean);
      if (options.length < 1) throw new Error("至少需要 1 个投票选项");
      if (values.max_choices > options.length) throw new Error("最多可选项数不能大于选项数量");

      var startSec = toUnixSeconds(values.time_range && values.time_range[0]);
      var endSec = toUnixSeconds(values.time_range && values.time_range[1]);
      if (!startSec || !endSec) throw new Error("请选择开始/结束时间");
      if (startSec >= endSec) throw new Error("开始时间必须早于结束时间");

      // 构建资格规则对象
      var eligibilityRule = {
        require_formal_member: !!values.require_formal_member,
        min_party_years: parseInt(String(values.min_party_years || "0"), 10),
        require_org_code: String(values.require_org_code || "").trim(),
        require_active_status: !!values.require_active_status,
        require_fee_paid: !!values.require_fee_paid,
        require_no_conflict: !!values.require_no_conflict,
      };

      // 1) 先调用后端计算资格规则哈希
      var hashResponse = await fetch(`${getFrontendEnv().backendBaseUrl}/api/voteAction/calculate-hash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eligibility_rule: eligibilityRule }),
      });
      
      if (!hashResponse.ok) {
        throw new Error("计算资格规则哈希失败");
      }
      
      var hashData = await hashResponse.json();
      var eligibilityRuleHash = hashData.hash;
      
      if (!eligibilityRuleHash) {
        throw new Error("未获取到资格规则哈希");
      }

      // 2) 链上创建投票（包含 eligibilityRuleHash）
      var tx = await contract.createVote(
        values.vote_title,
        values.vote_type,
        startSec,
        endSec,
        values.max_choices,
        options,
        eligibilityRuleHash
      );
      var receipt = await tx.wait();
      var blockNumber = receipt && receipt.blockNumber;
      var txHash = tx && tx.hash;
      var block = blockNumber ? await provider.getBlock(blockNumber) : null;
      var blockTs = block && block.timestamp;

      // 从事件里取链上 voteId
      var chainVoteId = "";
      if (receipt && Array.isArray(receipt.logs)) {
        for (var i = 0; i < receipt.logs.length; i++) {
          try {
            var parsed = contract.interface.parseLog(receipt.logs[i]);
            if (parsed && parsed.name === "VoteCreated") {
              chainVoteId = String(parsed.args && parsed.args.voteId);
              break;
            }
          } catch (err) {
            // ignore
          }
        }
      }

      if (!chainVoteId) {
        throw new Error("未解析到 VoteCreated 事件，无法获取 chain_vote_id");
      }

      // 3) 写入数据库（使用真实的 chain_vote_id）
      await addVoteActionDb({
        chain_vote_id: chainVoteId,
        vote_title: values.vote_title,
        vote_type: values.vote_type,
        party_org_id: values.party_org_id,
        start_time: new Date(startSec * 1000).toISOString(),
        end_time: new Date(endSec * 1000).toISOString(),
        max_choices: values.max_choices,
        description: values.description,
        description_cid: values.description_cid,
        status: 0,
        options: options,
        eligibility_rule: eligibilityRule,
        block_height: blockNumber || null,
        transaction_hash: txHash || null,
      });

      Modal.success({
        title: "投票创建成功",
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="投票标题">{values.vote_title}</Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <Text code>{txHash || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">{blockNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="区块时间">{formatUnixSeconds(blockTs)}</Descriptions.Item>
            </Descriptions>
          </Space>
        ),
      });

      setOpenCreate(false);
      form.resetFields();

      // 创建成功后自动刷新列表
      setPage(1);
      await fetchList({ keyword, status, page: 1, pageSize, party_org_id: myPartyOrgId });
    } catch (e) {
      console.error(e);
      message.error(getReadableEthersError(e) || "创建投票失败");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {mode === "hot" ? "热门投票" : "投票管理"}
          </Title>
          <Text type="secondary">
            党组织管理员：{walletAddress ? shortAddress(walletAddress) : "未连接钱包"}
          </Text>
        </div>
        {mode === "hot" ? (
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
              刷新
            </Button>
          </Space>
        ) : (
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
              创建投票
            </Button>
          </Space>
        )}
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
            {mode === "hot" ? (
              <Select
                value={"1"}
                disabled
                style={{ width: "100%" }}
                options={[{ value: "1", label: "投票中" }]}
              />
            ) : (
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
            )}
          </Col>

          <Col xs={24} md={8} style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleSearch}>搜索</Button>
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          {pagedItems.length === 0 && !loading ? (
            <Empty description="暂无投票" />
          ) : (
            <Row gutter={[12, 12]}>
              {pagedItems.map((it) => (
                <Col key={String(it.vote_id)} xs={24} sm={12} md={8}>
                  <Card
                    size="small"
                    title={it.vote_title}
                    style={{ borderRadius: 12 }}
                    extra={renderVoteStatusAction(it)}
                    loading={loading}
                    hoverable
                    onClick={() => handleOpenDetail(it)}
                  >
                    <Descriptions size="small" column={1} colon={false}>
                      <Descriptions.Item label="党组织">{it.org_name || "-"}</Descriptions.Item>
                      <Descriptions.Item label="组织编码">{it.org_code || "-"}</Descriptions.Item>
                      <Descriptions.Item label="负责人">{it.leader_name || "-"}</Descriptions.Item>
                      <Descriptions.Item label="类型">{voteTypeLabel(it.vote_type)}</Descriptions.Item>
                      <Descriptions.Item label="开始">{formatDateTime(it.start_time)}</Descriptions.Item>
                      <Descriptions.Item label="结束">{formatDateTime(it.end_time)}</Descriptions.Item>
                      <Descriptions.Item label="最多可选">{it.max_choices}</Descriptions.Item>
                      <Descriptions.Item label="选项">
                        {(it.options || []).length ? (
                          <Space wrap>
                            {(it.options || []).map((op) => (
                              <Tag key={`${it.vote_id}-${op.option_index}`}>{op.option_text}</Tag>
                            ))}
                          </Space>
                        ) : (
                          "-"
                        )}
                      </Descriptions.Item>
                    </Descriptions>
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

    <Modal
      title="创建投票"
      open={openCreate}
      onCancel={() => {
        if (createLoading) return;
        setOpenCreate(false);
      }}
      onOk={handleCreateSubmit}
      confirmLoading={createLoading}
      okText="创建"
      cancelText="取消"
      width={720}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ 
          vote_type: 0, 
          max_choices: 1, 
          options: [{ option_text: "" }, { option_text: "" }],
          require_formal_member: false,
          min_party_years: 0,
          require_org_code: "",
          require_active_status: false,
          require_fee_paid: false,
          require_no_conflict: false,
        }}
      >
        <Form.Item
          label="党组织"
          name="party_org_id"
          rules={[{ required: true, message: "请输入党组织" }]}
        >
          <Select
            placeholder="请选择你的党组织"
            options={partyOrgOptions}
            showSearch
            optionFilterProp="label"
            notFoundContent="未找到党组织（可在系统管理员端先创建并绑定管理员地址）"
            onChange={(value) => {
              // 当选择党组织时，自动填充组织编码
              const selectedOrg = partyOrgOptions.find(opt => opt.value === value);
              if (selectedOrg) {
                const orgCode = selectedOrg.org_code || "";
                form.setFieldValue("require_org_code", orgCode);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          label="投票标题"
          name="vote_title"
          rules={[{ required: true, message: "请输入投票标题" }]}
        >
          <Input placeholder="例如：支部书记候选人投票" maxLength={200} />
        </Form.Item>

        <Form.Item label="投票类型" name="vote_type" rules={[{ required: true, message: "请选择投票类型" }]}>
          <Select
            options={[
              { value: 0, label: "差额选举" },
              { value: 1, label: "决议表决" },
              { value: 2, label: "评议评价" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="投票时间范围"
          name="time_range"
          rules={[{ required: true, message: "请选择开始/结束时间" }]}
        >
          <DatePicker.RangePicker showTime style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="最多可选项数"
          name="max_choices"
          rules={[{ required: true, message: "请输入最多可选项数" }]}
        >
          <InputNumber min={1} max={50} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="投票资格规则" style={{ marginBottom: 8 }}>
          <Text type="secondary">选择该投票需要验证的资格条件（可多选）</Text>
        </Form.Item>

        <Form.Item name="require_formal_member" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox>要求正式党员身份</Checkbox>
        </Form.Item>

        <Form.Item
          label="最低党龄要求（年）"
          name="min_party_years"
          style={{ marginBottom: 8 }}
        >
          <InputNumber min={0} max={100} placeholder="0表示不限制" style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="要求所属党组织编码"
          name="require_org_code"
          style={{ marginBottom: 8 }}
          tooltip="选择党组织后会自动填充该组织的编码，也可以手动修改"
        >
          <Input placeholder="自动填充或手动输入，例如：110203 不填则默认不要求" maxLength={50} />
        </Form.Item>

        <Form.Item name="require_active_status" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox>要求党籍活跃状态</Checkbox>
        </Form.Item>

        <Form.Item name="require_fee_paid" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox>要求已缴纳党费</Checkbox>
        </Form.Item>

        <Form.Item name="require_no_conflict" valuePropName="checked" style={{ marginBottom: 16 }}>
          <Checkbox>要求无利益冲突</Checkbox>
        </Form.Item>

        <Form.Item label="投票说明" name="description">
          <Input.TextArea rows={3} placeholder="可选" />
        </Form.Item>

        <Form.Item label="说明 CID" name="description_cid">
          <Input placeholder="可选" />
        </Form.Item>

        <Form.Item label="投票选项">
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                {fields.map(({ key, name, ...restField }, idx) => (
                  <Space key={key} align="baseline" style={{ display: "flex" }}>
                    <Form.Item
                      {...restField}
                      name={[name, "option_text"]}
                      rules={[{ required: true, message: "请输入选项内容" }]}
                      style={{ flex: 1, marginBottom: 0 }}
                    >
                      <Input placeholder={`选项 ${idx + 1}`} maxLength={200} />
                    </Form.Item>
                    {fields.length > 1 ? (
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    ) : null}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ option_text: "" })} icon={<PlusOutlined />} block>
                  添加选项
                </Button>
              </Space>
            )}
          </Form.List>
        </Form.Item>
      </Form>
    </Modal>

    <Modal
      title={detail ? `投票详情：${detail.vote_title}` : "投票详情"}
      open={openDetail}
      onCancel={() => setOpenDetail(false)}
      footer={null}
      width={800}
      destroyOnHidden
    >
      {!detail ? (
        <Empty description="暂无详情" />
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* 基本信息 */}
          <Card title="基本信息" size="small" style={{ borderRadius: 8 }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="投票标题" span={2}>{detail.vote_title}</Descriptions.Item>
              <Descriptions.Item label="党组织名称">{detail.org_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="党组织编码">{detail.org_code || "-"}</Descriptions.Item>
              <Descriptions.Item label="负责人">{detail.leader_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="投票类型">{voteTypeLabel(detail.vote_type)}</Descriptions.Item>
              <Descriptions.Item label="投票状态" span={2}>{voteStatusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatDateTime(detail.start_time)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{formatDateTime(detail.end_time)}</Descriptions.Item>
              <Descriptions.Item label="最多可选">{detail.max_choices}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(detail.created_at)}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 投票资格规则 */}
          <Card title="投票资格规则" size="small" style={{ borderRadius: 8 }}>
            {detail.eligibility_rule ? (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {detail.eligibility_rule.require_formal_member ? (
                  <Tag color="blue" icon={<span>✓</span>}>要求正式党员身份</Tag>
                ) : null}
                {detail.eligibility_rule.min_party_years > 0 ? (
                  <Tag color="green" icon={<span>✓</span>}>
                    最低党龄要求：{detail.eligibility_rule.min_party_years} 年
                  </Tag>
                ) : null}
                {detail.eligibility_rule.require_org_code && detail.eligibility_rule.require_org_code !== 0 ? (
                  <Tag color="purple" icon={<span>✓</span>}>
                    要求所属党组织：{detail.eligibility_rule.require_org_code}
                  </Tag>
                ) : null}
                {detail.eligibility_rule.require_active_status ? (
                  <Tag color="cyan" icon={<span>✓</span>}>要求党籍活跃状态</Tag>
                ) : null}
                {detail.eligibility_rule.require_fee_paid ? (
                  <Tag color="orange" icon={<span>✓</span>}>要求已缴纳党费</Tag>
                ) : null}
                {detail.eligibility_rule.require_no_conflict ? (
                  <Tag color="red" icon={<span>✓</span>}>要求无利益冲突</Tag>
                ) : null}
                {!detail.eligibility_rule.require_formal_member &&
                  !detail.eligibility_rule.min_party_years &&
                  (!detail.eligibility_rule.require_org_code || detail.eligibility_rule.require_org_code === 0) &&
                  !detail.eligibility_rule.require_active_status &&
                  !detail.eligibility_rule.require_fee_paid &&
                  !detail.eligibility_rule.require_no_conflict ? (
                    <Text type="secondary">无特殊资格要求</Text>
                  ) : null}
              </Space>
            ) : (
              <Text type="secondary">该投票未设置资格规则</Text>
            )}
          </Card>

          {/* 投票选项 */}
          <Card title="投票选项" size="small" style={{ borderRadius: 8 }}>
            {(detail.options || []).length ? (
              <Space wrap>
                {(detail.options || []).map((op, idx) => (
                  <Tag key={`detail-${detail.vote_id}-${op.option_index}`} color="default" style={{ fontSize: 14, padding: '4px 12px' }}>
                    选项 {idx + 1}：{op.option_text}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">暂无选项</Text>
            )}
          </Card>

          {/* 其他信息 */}
          <Card title="其他信息" size="small" style={{ borderRadius: 8 }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="投票说明">{detail.description || "-"}</Descriptions.Item>
              <Descriptions.Item label="说明 CID">{detail.description_cid || "-"}</Descriptions.Item>
              <Descriptions.Item label="区块高度">{detail.block_height || "-"}</Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <Text code copyable={!!detail.transaction_hash} style={{ fontSize: 12 }}>
                  {detail.transaction_hash || "-"}
                </Text>
              </Descriptions.Item>
              {detail.eligibility_rule_hash && (
                <Descriptions.Item label="资格规则哈希">
                  <Text code copyable style={{ fontSize: 12 }}>
                    {detail.eligibility_rule_hash}
                  </Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Space>
      )}
    </Modal>
  </Space>
);
}
