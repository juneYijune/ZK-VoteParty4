import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { ethers } from "ethers";

import { PartyVotingContract } from "@/contracts/partyVoting";
import { connectWallet } from "@/services/wallet";
import {
  addPartyOrgDb,
  getPartyOrgDetail,
  listPartyOrgs,
  updatePartyOrgAdminAddress,
  updatePartyOrgOffchain,
} from "@/services/partyOrgs";
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

function waitTxWithTimeout(tx, timeoutMs) {
  return Promise.race([
    tx.wait(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("交易确认超时，请检查网络/是否已在钱包确认")), timeoutMs);
    }),
  ]);
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

export function AdminDashboard() {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  const [openDetail, setOpenDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();

  const [openChangeAdmin, setOpenChangeAdmin] = useState(false);
  const [changeAdminLoading, setChangeAdminLoading] = useState(false);
  const [changeAdminForm] = Form.useForm();

  async function handleOpenDetail(org_id) {
    try {
      setOpenDetail(true);
      setDetail(null);
      setDetailLoading(true);

      var data = await getPartyOrgDetail(org_id);
      setDetail(data);
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleOpenEdit() {
    if (!detail) return;
    setOpenEdit(true);
  }

  async function handleEditSubmit() {
    try {
      const values = await editForm.validateFields();
      if (!values.org_id && detail && detail.org_id) {
        values.org_id = detail.org_id;
      }
      var oid = parseInt(String(values.org_id || ""), 10);
      if (!Number.isFinite(oid) || oid <= 0) {
        message.error("党组织ID无效，请重新打开详情后再编辑");
        return;
      }
      setEditLoading(true);

      await updatePartyOrgOffchain(values);
      message.success("更新成功");

      setOpenEdit(false);

      if (detail && detail.org_id) {
        await handleOpenDetail(detail.org_id);
      }
      await fetchList();
    } catch (e) {
      console.error(e);
      message.error(e.message || "更新失败");
    } finally {
      setEditLoading(false);
    }
  }

  function handleOpenChangeAdmin() {
    if (!detail) return;
    // 允许停用状态的党组织修改管理员地址（用于重启）
    setOpenChangeAdmin(true);
  }

  async function handleChangeAdminSubmit() {
    try {
      const values = await changeAdminForm.validateFields();

      if (!PartyVotingContract.address) {
        throw new Error("未配置合约地址 NEXT_PUBLIC_PARTY_VOTING_ADDRESS");
      }

      if (!window.ethereum) {
        throw new Error("未检测到 MetaMask");
      }

      setChangeAdminLoading(true);
      await ensureExpectedChain();

      var adminAddr = await connectWallet();
      if (!adminAddr) throw new Error("未获取到钱包地址");

      var provider = new ethers.BrowserProvider(window.ethereum);
      var signer = await provider.getSigner();

      var code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error("当前网络该地址没有部署合约，请确认网络与合约部署一致");
      }

      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, signer);

      var newAddr = ethers.getAddress(values.new_orger_address);
      
      // 判断是否为停用状态
      var isDisabled = detail && detail.status === 0;
      
      if (isDisabled) {
        // 停用状态：只需添加新地址即可重启
        var confirmOk = await new Promise((resolve) => {
          Modal.confirm({
            title: "确认重启党组织？",
            content: (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Text type="secondary">该操作会添加新的管理员地址并重启该党组织。</Text>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="新管理员地址">
                    <Text code>{newAddr}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="操作说明">
                    <Text>添加新管理员后，该党组织将被重新启用</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            ),
            okText: "确认重启",
            cancelText: "取消",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });

        if (!confirmOk) {
          return;
        }

        const loadingKey = "restart-org-tx";
        const waitMs = 120000;
        message.loading({ content: "请在钱包确认交易", key: loadingKey, duration: 0 });

        var tx = await contract.addPartyOrg(newAddr);
        message.loading({ content: "等待交易打包", key: loadingKey, duration: 0 });
        var receipt = await waitTxWithTimeout(tx, waitMs);
        var blockNumber = receipt && receipt.blockNumber;
        var txHash = tx && tx.hash;
        var block = blockNumber ? await provider.getBlock(blockNumber) : null;
        var blockTs = block && block.timestamp;

        // 更新数据库：新地址和启用状态
        await updatePartyOrgAdminAddress({
          org_id: values.org_id,
          orger_address: newAddr,
          status: 1, // 重新启用
          block_height: blockNumber || null,
          transaction_hash: txHash || null,
        });

        Modal.success({
          title: "党组织重启成功",
          content: (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="新管理员地址">
                  <Text code>{newAddr}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="交易哈希">
                  <Text code>{txHash || "-"}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="区块高度">{blockNumber || "-"}</Descriptions.Item>
                <Descriptions.Item label="区块时间">{formatUnixSeconds(blockTs)}</Descriptions.Item>
              </Descriptions>
            </Space>
          ),
        });

        message.success({ content: "党组织已重启", key: loadingKey, duration: 1.5 });
      } else {
        // 启用状态：需要先撤销旧地址，再添加新地址
        var oldCandidate = values.old_orger_address;
        if ((!oldCandidate || !ethers.isAddress(oldCandidate)) && detail && detail.orger_address) {
          oldCandidate = detail.orger_address;
        }
        if (!oldCandidate || !ethers.isAddress(oldCandidate)) {
          throw new Error("旧管理员地址无效");
        }
        var oldAddr = ethers.getAddress(oldCandidate);

        if (oldAddr === newAddr) {
          throw new Error("新旧管理员地址不能相同");
        }

        var confirmOk = await new Promise((resolve) => {
          Modal.confirm({
            title: "确认修改管理员地址？",
            content: (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Text type="secondary">该操作会在链上执行两笔交易：先撤销旧地址，再添加新地址。</Text>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="旧管理员地址">
                    <Text code>{oldAddr}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="新管理员地址">
                    <Text code>{newAddr}</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            ),
            okText: "确认执行",
            cancelText: "取消",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });

        if (!confirmOk) {
          return;
        }

        const loadingKey = "change-admin-tx";
        const waitMs = 120000;
        message.loading({ content: "请在钱包确认交易（1/2：撤销旧地址）", key: loadingKey, duration: 0 });

        var tx1 = await contract.removePartyOrg(oldAddr);
        message.loading({ content: "等待交易打包（1/2：撤销旧地址）", key: loadingKey, duration: 0 });
        await waitTxWithTimeout(tx1, waitMs);

        message.loading({ content: "请在钱包确认交易（2/2：添加新地址）", key: loadingKey, duration: 0 });
        var tx2 = await contract.addPartyOrg(newAddr);
        message.loading({ content: "等待交易打包（2/2：添加新地址）", key: loadingKey, duration: 0 });
        var receipt2 = await waitTxWithTimeout(tx2, waitMs);
        var blockNumber = receipt2 && receipt2.blockNumber;
        var txHash = tx2 && tx2.hash;
        var block = blockNumber ? await provider.getBlock(blockNumber) : null;
        var blockTs = block && block.timestamp;

        await updatePartyOrgAdminAddress({
          org_id: values.org_id,
          orger_address: newAddr,
          block_height: blockNumber || null,
          transaction_hash: txHash || null,
        });

        Modal.success({
          title: "管理员地址修改成功",
          content: (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="交易哈希">
                  <Text code>{txHash || "-"}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="区块高度">{blockNumber || "-"}</Descriptions.Item>
                <Descriptions.Item label="区块时间">{formatUnixSeconds(blockTs)}</Descriptions.Item>
              </Descriptions>
            </Space>
          ),
        });

        message.success({ content: "链上交易完成", key: loadingKey, duration: 1.5 });
      }

      setOpenChangeAdmin(false);

      if (detail && detail.org_id) {
        await handleOpenDetail(detail.org_id);
      }
      await fetchList();
    } catch (e) {
      console.error(e);
      message.error(getReadableEthersError(e) || "修改失败");
    } finally {
      setChangeAdminLoading(false);
      message.destroy("change-admin-tx");
      message.destroy("restart-org-tx");
    }
  }

  async function fetchList(next) {
    try {
      setLoading(true);

      var params = next || { keyword, status, page, pageSize };
      var s = params.status;
      if (s === "all") s = "";

      var res = await listPartyOrgs({
        keyword: params.keyword,
        status: s,
        page: params.page,
        pageSize: params.pageSize,
      });

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
  }, [page, pageSize, status]);

  const pagedItems = useMemo(() => items, [items]);

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

      var adminAddr = await connectWallet();
      if (!adminAddr) throw new Error("未获取到钱包地址");

      var provider = new ethers.BrowserProvider(window.ethereum);
      var signer = await provider.getSigner();

      var code = await provider.getCode(PartyVotingContract.address);
      if (!code || code === "0x") {
        throw new Error("当前网络该地址没有部署合约，请确认网络与合约部署一致");
      }

      var contract = new ethers.Contract(PartyVotingContract.address, PartyVotingContract.abi, signer);

      // 1) 先链上创建党组织（必须用系统管理员钱包）
      var tx = await contract.addPartyOrg(values.orger_address);
      var receipt = await tx.wait();
      var blockNumber = receipt && receipt.blockNumber;
      var txHash = tx && tx.hash;
      var block = blockNumber ? await provider.getBlock(blockNumber) : null;
      var blockTs = block && block.timestamp;

      // 2) 再写入数据库
      await addPartyOrgDb({
        org_name: values.org_name,
        org_code: values.org_code,
        org_type: values.org_type,
        leader_name: values.leader_name,
        orger_address: values.orger_address,
        description: values.description,
        description_cid: values.description_cid,
        status: values.status,
        block_height: blockNumber || null,
        transaction_hash: txHash || null,
      });

      Modal.success({
        title: "党组织创建成功",
        content: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Descriptions size="small" column={1} bordered>
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

      setPage(1);
      await fetchList({ keyword, status, page: 1, pageSize });
    } catch (e) {
      console.error(e);
      message.error(getReadableEthersError(e) || "创建失败");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          党组织管理
        </Title>
        <Text type="secondary">在此创建与维护党组织信息。</Text>
      </div>

      <Card
        style={{ borderRadius: 12 }}
        styles={{ body: { padding: 16 } }}
        title="党组织列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchList()} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
              新增
            </Button>
          </Space>
        }
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={14} md={10}>
            <Input
              placeholder="搜索党组织名称/编码/负责人/地址"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>

          <Col xs={24} sm={10} md={6}>
            <Select
              value={status}
              style={{ width: "100%" }}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: "全部状态" },
                { value: "1", label: "启用" },
                { value: "0", label: "停用" },
              ]}
            />
          </Col>

          <Col xs={24} md={8} style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={handleSearch}>搜索</Button>
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          {pagedItems.length === 0 && !loading ? (
            <Empty description="暂无党组织" />
          ) : (
            <Row gutter={[12, 12]}>
              {pagedItems.map((it) => (
                <Col key={String(it.org_id)} xs={24} sm={12} md={8}>
                  <Card
                    size="small"
                    title={it.org_name}
                    style={{ borderRadius: 12 }}
                    hoverable
                    onClick={() => handleOpenDetail(it.org_id)}
                    extra={
                      it.status === 1 ? (
                        <Tag color="green">启用</Tag>
                      ) : (
                        <Tag color="red">停用</Tag>
                      )
                    }
                    loading={loading}
                  >
                    <Descriptions size="small" column={1} colon={false}>
                      <Descriptions.Item label="编码">{it.org_code}</Descriptions.Item>
                      <Descriptions.Item label="类型">{it.org_type || "-"}</Descriptions.Item>
                      <Descriptions.Item label="负责人">{it.leader_name || "-"}</Descriptions.Item>
                      <Descriptions.Item label="管理员地址">
                        <Text code>{shortAddress(it.orger_address)}</Text>
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
        title="新增党组织"
        open={openCreate}
        onCancel={() => {
          if (createLoading) return;
          setOpenCreate(false);
        }}
        onOk={handleCreateSubmit}
        confirmLoading={createLoading}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="党组织名称"
            name="org_name"
            rules={[{ required: true, message: "请输入党组织名称" }]}
          >
            <Input placeholder="例如：第一党支部" />
          </Form.Item>

          <Form.Item
            label="党组织编码"
            name="org_code"
            rules={[{ required: true, message: "请输入党组织编码" }]}
          >
            <Input placeholder="例如：DZB-001" />
          </Form.Item>

          <Form.Item label="党组织类型" name="org_type">
            <Input placeholder="例如：支部/总支/党委" />
          </Form.Item>

          <Form.Item label="负责人姓名" name="leader_name">
            <Input placeholder="例如：张三" />
          </Form.Item>

          <Form.Item
            label="党组织管理员地址"
            name="orger_address"
            rules={[
              { required: true, message: "请输入管理员地址" },
              {
                validator: async (_, v) => {
                  if (!v) return;
                  if (!ethers.isAddress(v)) throw new Error("地址格式不正确");
                },
              },
            ]}
          >
            <Input placeholder="0x..." />
          </Form.Item>

          <Form.Item label="组织简介" name="description">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>

          <Form.Item label="简介 CID" name="description_cid">
            <Input placeholder="可选" />
          </Form.Item>

          <Form.Item label="状态" name="status" initialValue={1}>
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detail ? `党组织详情：${detail.org_name}` : "党组织详情"}
        open={openDetail}
        onCancel={() => setOpenDetail(false)}
        footer={
          detail ? (
            <Space>
              <Button onClick={() => setOpenDetail(false)}>关闭</Button>
              <Button type="primary" onClick={handleOpenEdit}>
                编辑链下信息
              </Button>
              <Button danger onClick={handleOpenChangeAdmin}>
                修改管理员地址
              </Button>
            </Space>
          ) : (
            <Space>
              <Button onClick={() => setOpenDetail(false)}>关闭</Button>
            </Space>
          )
        }
        width={640}
        destroyOnHidden
      >
        {detailLoading ? (
          <Text type="secondary">加载中...</Text>
        ) : !detail ? (
          <Empty description="暂无详情" />
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Descriptions size="middle" column={1} bordered>
              <Descriptions.Item label="党组织ID">{detail.org_id}</Descriptions.Item>
              <Descriptions.Item label="党组织名称">{detail.org_name}</Descriptions.Item>
              <Descriptions.Item label="党组织编码">{detail.org_code}</Descriptions.Item>
              <Descriptions.Item label="党组织类型">{detail.org_type || "-"}</Descriptions.Item>
              <Descriptions.Item label="负责人">{detail.leader_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="管理员地址">
                <Text code>{detail.orger_address}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="简介">{detail.description || "-"}</Descriptions.Item>
              <Descriptions.Item label="简介 CID">{detail.description_cid || "-"}</Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <Text code>{detail.transaction_hash || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">{detail.block_height || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(detail.created_at)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatDateTime(detail.updated_at)}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>

      <Modal
        title={detail ? `编辑党组织：${detail.org_name}` : "编辑党组织"}
        open={openEdit}
        afterOpenChange={(open) => {
          if (!open) return;
          if (!detail) return;
          editForm.resetFields();
          editForm.setFieldsValue({
            org_id: detail.org_id,
            org_name: detail.org_name,
            org_code: detail.org_code,
            org_type: detail.org_type,
            leader_name: detail.leader_name,
            description: detail.description,
            description_cid: detail.description_cid,
            status: detail.status,
          });
        }}
        onCancel={() => {
          if (editLoading) return;
          setOpenEdit(false);
        }}
        onOk={handleEditSubmit}
        confirmLoading={editLoading}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item name="org_id" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="党组织名称" name="org_name" rules={[{ required: true, message: "请输入党组织名称" }]}>
            <Input placeholder="例如：第一党支部" />
          </Form.Item>

          <Form.Item label="党组织编码" name="org_code" rules={[{ required: true, message: "请输入党组织编码" }]}>
            <Input placeholder="例如：DZB-001" />
          </Form.Item>

          <Form.Item label="党组织类型" name="org_type">
            <Input placeholder="例如：支部/总支/党委" />
          </Form.Item>

          <Form.Item label="负责人姓名" name="leader_name">
            <Input placeholder="例如：张三" />
          </Form.Item>

          <Form.Item label="组织简介" name="description">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>

          <Form.Item label="简介 CID" name="description_cid">
            <Input placeholder="可选" />
          </Form.Item>

          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { value: 1, label: "启用" },
                { value: 0, label: "停用" },
              ]}
            />
          </Form.Item>

          <Form.Item label="管理员地址">
            <Input value={detail ? detail.orger_address : ""} disabled />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          detail
            ? detail.status === 0
              ? `重启党组织：${detail.org_name}`
              : `修改管理员地址：${detail.org_name}`
            : "修改管理员地址"
        }
        open={openChangeAdmin}
        afterOpenChange={(open) => {
          if (!open) return;
          if (!detail) return;
          changeAdminForm.resetFields();
          changeAdminForm.setFieldsValue({
            org_id: detail.org_id,
            old_orger_address: detail.orger_address || "",
            new_orger_address: "",
          });
        }}
        onCancel={() => {
          if (changeAdminLoading) return;
          setOpenChangeAdmin(false);
        }}
        onOk={handleChangeAdminSubmit}
        confirmLoading={changeAdminLoading}
        okText={detail && detail.status === 0 ? "重启" : "提交"}
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={changeAdminForm} layout="vertical" preserve={false}>
          <Form.Item name="org_id" hidden>
            <Input />
          </Form.Item>

          {detail && detail.status === 0 ? (
            // 停用状态：显示提示信息
            <Space direction="vertical" size={12} style={{ width: "100%", marginBottom: 16 }}>
              <Text type="warning">
                该党组织当前处于停用状态。添加新的管理员地址后，该党组织将被重新启用。
              </Text>
              {detail.orger_address && (
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="原管理员地址">
                    <Text code type="secondary">
                      {detail.orger_address}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Space>
          ) : (
            // 启用状态：显示旧地址
            <Form.Item label="旧管理员地址" name="old_orger_address">
              <Input disabled />
            </Form.Item>
          )}

          <Form.Item
            label="新管理员地址"
            name="new_orger_address"
            rules={[
              { required: true, message: "请输入新管理员地址" },
              {
                validator: async (_, v) => {
                  if (!v) return;
                  if (!ethers.isAddress(v)) throw new Error("地址格式不正确");
                },
              },
            ]}
          >
            <Input placeholder="0x..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
