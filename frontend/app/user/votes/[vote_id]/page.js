"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Modal,
  Space,
  Tag,
  Typography,
  message,
  Row,
  Col,
  Statistic,
  Spin,
} from "antd";
import { LeftOutlined, ReloadOutlined, CheckCircleOutlined, LockOutlined } from "@ant-design/icons";
import { ethers } from "ethers";

import { UserLayout } from "@/components";
import { PartyVotingContract } from "@/contracts/partyVoting";
import { connectWallet } from "@/services/wallet";
import { getVoteDetail } from "@/services/voteAction";
import { recordVote, votedStatus } from "@/services/voteRecords";
import { getFrontendEnv } from "@/lib/env";
import { getVerification } from "@/utils/zkVerificationStorage";

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

// 投票状态标签
function voteStatusTag(status) {
  if (status === 1) return <Tag color="blue">投票已开启</Tag>;
  if (status === 2) return <Tag color="default">投票已关闭</Tag>;
  return <Tag color="gold">投票未开启</Tag>;
}

export default function UserVoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const voteId = params && params.vote_id;

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);

  const [checkingVoted, setCheckingVoted] = useState(false);
  const [hasVotedAlready, setHasVotedAlready] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 资格验证状态
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [isEligibilityVerified, setIsEligibilityVerified] = useState(false);

  const userAddress = useMemo(() => {
    try {
      return localStorage.getItem("wallet_address") || "";
    } catch (e) {
      return "";
    }
  }, []);

  async function fetchDetail() {
    try {
      setLoading(true);
      setDetail(null);
      setSelected([]);

      var data = await getVoteDetail(voteId);
      setDetail(data);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function fetchVoted() {
    try {
      if (!userAddress) return;
      if (!voteId) return;

      setCheckingVoted(true);
      var res = await votedStatus({ vote_id: voteId, user_address: userAddress });
      setHasVotedAlready(!!(res && res.voted));
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingVoted(false);
    }
  }

  // 检查资格验证状态
  useEffect(() => {
    async function checkEligibility() {
      try {
        setCheckingEligibility(true);
        
        if (!userAddress) {
          message.error("请先连接钱包");
          router.push("/user/votes");
          return;
        }

        if (!voteId) {
          return;
        }

        // 从 localStorage 检查是否已通过资格验证
        const verification = getVerification(userAddress, parseInt(voteId));
        
        if (!verification || !verification.is_verified) {
          message.warning("您还未通过该投票的资格验证，请先完成验证");
          router.push("/user/votes");
          return;
        }

        // 验证通过
        setIsEligibilityVerified(true);
      } catch (error) {
        console.error("检查资格验证失败:", error);
        message.error("检查资格验证失败");
        router.push("/user/votes");
      } finally {
        setCheckingEligibility(false);
      }
    }

    checkEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteId, userAddress]);

  useEffect(() => {
    if (isEligibilityVerified) {
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteId, isEligibilityVerified]);

  useEffect(() => {
    if (isEligibilityVerified) {
      fetchVoted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteId, userAddress, isEligibilityVerified]);

  const maxChoices = useMemo(() => {
    if (!detail) return 1;
    var m = parseInt(String(detail.max_choices ?? detail.maxChoices ?? "1"), 10);
    if (!Number.isFinite(m) || m <= 0) return 1;
    return m;
  }, [detail]);

  const options = useMemo(() => {
    return (detail && detail.options) || [];
  }, [detail]);

  function handleToggle(idx, checked) {
    setSelected((prev) => {
      var next = prev.slice();
      var exists = next.includes(idx);
      if (checked && !exists) {
        if (next.length >= maxChoices) {
          message.error(`最多只能选择 ${maxChoices} 项`);
          return prev;
        }
        next.push(idx);
        return next;
      }
      if (!checked && exists) {
        return next.filter((x) => x !== idx);
      }
      return prev;
    });
  }

  async function handleSubmitVote() {
    try {
      if (!detail) return;

      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }
      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }
      if (!selected.length) {
        message.error("请先选择投票选项");
        return;
      }
      if (selected.length > maxChoices) {
        message.error(`最多只能选择 ${maxChoices} 项`);
        return;
      }
      if (hasVotedAlready) {
        message.error("你已投过该投票");
        return;
      }

      setSubmitting(true);
      await ensureExpectedChain();

      var addr = await connectWallet();
      if (!addr) throw new Error("未获取到钱包地址");

      var provider = new ethers.BrowserProvider(window.ethereum);
      var signer = await provider.getSigner();

      var code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error("当前网络该地址没有部署合约，请确认网络与合约部署一致");
      }

      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, signer);

      var chainVoteId = detail.chain_vote_id;
      if (typeof chainVoteId === "string") chainVoteId = chainVoteId.trim();
      if (chainVoteId === undefined || chainVoteId === null || chainVoteId === "") {
        throw new Error("该投票缺少 chain_vote_id");
      }

      var loadingKey = "user-cast-vote";
      message.loading({ content: "请在钱包确认投票交易", key: loadingKey, duration: 0 });

      var tx = await contract.castVote(chainVoteId, selected);
      message.loading({ content: "等待交易打包", key: loadingKey, duration: 0 });

      var receipt = await tx.wait();
      var blockNumber = receipt && receipt.blockNumber;
      var txHash = tx && tx.hash;
      var block = blockNumber ? await provider.getBlock(blockNumber) : null;
      var blockTs = block && block.timestamp;

      message.loading({ content: "写入链下投票记录", key: loadingKey, duration: 0 });

      await recordVote({
        vote_id: detail.vote_id,
        user_address: addr,
        selected_options: selected,
        tx_hash: txHash,
        block_number: blockNumber,
        block_timestamp: blockTs,
      });

      setHasVotedAlready(true);

      Modal.success({
        title: "投票成功",
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="交易哈希">
                <Text code>{txHash || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">{blockNumber || "-"}</Descriptions.Item>
              <Descriptions.Item label="投票时间">{formatUnixSeconds(blockTs)}</Descriptions.Item>
              <Descriptions.Item label="选择的选项">
                {(selected || [])
                  .map((idx) => {
                    var op = (options || []).find((x) => x && x.option_index === idx);
                    return (op && op.option_text) || String(idx);
                  })
                  .join("、")}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ),
      });

      message.success({ content: "链上交易完成", key: loadingKey, duration: 1.5 });
    } catch (e) {
      console.error(e);
      message.error(getReadableEthersError(e) || "投票失败");
    } finally {
      setSubmitting(false);
      message.destroy("user-cast-vote");
    }
  }

  // 如果正在检查资格验证，显示加载状态
  if (checkingEligibility) {
    return (
      <UserLayout>
        <div style={{ 
          padding: "24px", 
          background: "#f0f2f5", 
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <Card style={{ textAlign: "center", minWidth: "300px" }}>
            <Space direction="vertical" size={16}>
              <Spin size="large" />
              <Text>正在验证访问权限...</Text>
            </Space>
          </Card>
        </div>
      </UserLayout>
    );
  }

  // 如果未通过资格验证，显示提示（理论上不会显示，因为会重定向）
  if (!isEligibilityVerified) {
    return (
      <UserLayout>
        <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
          <Card>
            <Alert
              type="warning"
              icon={<LockOutlined />}
              message="访问受限"
              description="您还未通过该投票的资格验证，请先在投票列表中完成验证。"
              showIcon
              action={
                <Button type="primary" onClick={() => router.push("/user/votes")}>
                  返回投票列表
                </Button>
              }
            />
          </Card>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          {/* 操作按钮 */}
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => router.push("/user/votes")}>
              返回列表
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchDetail} loading={loading}>
              刷新
            </Button>
          </Space>

          {/* 投票详情卡片 */}
          <Card 
            loading={loading}
            bordered={false}
            style={{ 
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {/* 标题和状态 */}
              <div>
                <Title level={3} style={{ margin: 0, marginBottom: "12px" }}>
                  {detail ? detail.vote_title : "投票详情"}
                </Title>
                <Space size={8}>
                  {detail ? voteStatusTag(detail.status) : null}
                  {checkingVoted ? (
                    <Tag>检查投票状态中...</Tag>
                  ) : hasVotedAlready ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">已投票</Tag>
                  ) : null}
                </Space>
              </div>

              <Divider style={{ margin: "8px 0" }} />

              {/* 基本信息 */}
              {detail && (
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ background: "#fafafa" }}>
                      <Statistic
                        title="投票类型"
                        value={detail.vote_type || "-"}
                        valueStyle={{ fontSize: "18px" }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ background: "#fafafa" }}>
                      <Statistic
                        title="最多可选"
                        value={maxChoices}
                        suffix="项"
                        valueStyle={{ fontSize: "18px", color: "#1890ff" }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ background: "#fafafa" }}>
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">开始时间</Text>
                        <Text strong>{formatDateTime(detail.start_time)}</Text>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Card size="small" style={{ background: "#fafafa" }}>
                      <Space direction="vertical" size={4}>
                        <Text type="secondary">结束时间</Text>
                        <Text strong>{formatDateTime(detail.end_time)}</Text>
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24}>
                    <Card size="small" style={{ background: "#fafafa" }}>
                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                        <Text type="secondary">所属党组织</Text>
                        <Space wrap>
                          <Text>
                            <Text type="secondary">名称：</Text>
                            <Text strong>{detail.org_name || "-"}</Text>
                          </Text>
                          <Divider type="vertical" />
                          <Text>
                            <Text type="secondary">编码：</Text>
                            {detail.org_code || "-"}
                          </Text>
                          <Divider type="vertical" />
                          <Text>
                            <Text type="secondary">负责人：</Text>
                            {detail.leader_name || "-"}
                          </Text>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              )}

              <Divider style={{ margin: "8px 0" }} />

              {/* 投票资格规则 */}
              {detail && (
                <Card 
                  title={<Text strong>投票资格规则</Text>}
                  size="small" 
                  style={{ background: "#fafafa", borderRadius: "8px" }}
                >
                  {detail.eligibility_rule ? (
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      {detail.eligibility_rule.require_formal_member ? (
                        <Tag color="blue" icon={<span>✓</span>} style={{ fontSize: "14px", padding: "4px 12px" }}>
                          要求正式党员身份
                        </Tag>
                      ) : null}
                      {detail.eligibility_rule.min_party_years > 0 ? (
                        <Tag color="green" icon={<span>✓</span>} style={{ fontSize: "14px", padding: "4px 12px" }}>
                          最低党龄要求：{detail.eligibility_rule.min_party_years} 年
                        </Tag>
                      ) : null}
                      {detail.eligibility_rule.require_org_code && detail.eligibility_rule.require_org_code !== 0 ? (
                        <Tag color="purple" icon={<span>✓</span>} style={{ fontSize: "14px", padding: "4px 12px" }}>
                          要求所属党组织：{detail.eligibility_rule.require_org_code}
                        </Tag>
                      ) : null}
                      {detail.eligibility_rule.require_active_status ? (
                        <Tag color="cyan" icon={<span>✓</span>} style={{ fontSize: "14px", padding: "4px 12px" }}>
                          要求党籍活跃状态
                        </Tag>
                      ) : null}
                      {detail.eligibility_rule.require_fee_paid ? (
                        <Tag color="orange" icon={<span>✓</span>} style={{ fontSize: "14px", padding: "4px 12px" }}>
                          要求已缴纳党费
                        </Tag>
                      ) : null}
                      {detail.eligibility_rule.require_no_conflict ? (
                        <Tag color="red" icon={<span>✓</span>} style={{ fontSize: "14px", padding: "4px 12px" }}>
                          要求无利益冲突
                        </Tag>
                      ) : null}
                      {!detail.eligibility_rule.require_formal_member &&
                        !detail.eligibility_rule.min_party_years &&
                        (!detail.eligibility_rule.require_org_code || detail.eligibility_rule.require_org_code === 0) &&
                        !detail.eligibility_rule.require_active_status &&
                        !detail.eligibility_rule.require_fee_paid &&
                        !detail.eligibility_rule.require_no_conflict ? (
                          <Text type="secondary">无特殊资格要求，所有党员均可参与投票</Text>
                        ) : null}
                    </Space>
                  ) : (
                    <Text type="secondary">该投票未设置资格规则</Text>
                  )}
                </Card>
              )}

              <Divider style={{ margin: "8px 0" }} />

              {/* 提示信息 */}
              {detail && detail.status !== 1 ? (
                <Alert 
                  type="warning" 
                  message="当前投票不在进行中，无法投票" 
                  showIcon 
                  style={{ borderRadius: "8px" }}
                />
              ) : hasVotedAlready ? (
                <Alert 
                  type="info" 
                  message="您已经投过票了" 
                  showIcon 
                  style={{ borderRadius: "8px" }}
                />
              ) : null}

              {/* 投票选项 */}
              <div>
                <Title level={5} style={{ marginBottom: "16px" }}>
                  投票选项（最多选择 {maxChoices} 项）
                </Title>
                <Card 
                  size="small" 
                  style={{ background: "#fafafa", maxHeight: "400px", overflow: "auto" }}
                >
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {(options || []).map((op) => {
                      var idx = op.option_index;
                      var text = op.option_text;
                      var checked = selected.includes(idx);
                      var disabled = hasVotedAlready || (detail && detail.status !== 1);
                      return (
                        <Card
                          key={String(idx)}
                          size="small"
                          hoverable={!disabled}
                          style={{
                            background: checked ? "#e6f7ff" : "#fff",
                            border: checked ? "2px solid #1890ff" : "1px solid #d9d9d9",
                            cursor: disabled ? "not-allowed" : "pointer"
                          }}
                          onClick={() => !disabled && handleToggle(idx, !checked)}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => handleToggle(idx, e.target.checked)}
                            style={{ width: "100%" }}
                          >
                            <Text strong={checked}>{text}</Text>
                          </Checkbox>
                        </Card>
                      );
                    })}
                  </Space>
                </Card>
              </div>

              <Divider style={{ margin: "8px 0" }} />

              {/* 操作按钮 */}
              <Space size={16}>
                <Button
                  type="primary"
                  size="large"
                  loading={submitting}
                  disabled={!detail || hasVotedAlready || (detail && detail.status !== 1)}
                  onClick={handleSubmitVote}
                  style={{ minWidth: "120px" }}
                >
                  提交投票
                </Button>
                <Button 
                  size="large"
                  onClick={() => router.push("/user/my-votes")}
                >
                  查看我的投票
                </Button>
              </Space>
            </Space>
          </Card>
        </Space>
      </div>
    </UserLayout>
  );
}
