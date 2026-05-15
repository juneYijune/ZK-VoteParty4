"use client";

import { useEffect, useState } from "react";
import { PartyOrgLayout } from "@/components";
import { getPartyOrgDetail, listPartyOrgs, updatePartyOrgOffchain } from "@/services/partyOrgs";
import { Button, Card, Descriptions, Empty, Form, Input, Modal, Select, Space, Tag, Typography, message } from "antd";

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

export default function PartyOrgMyOrgPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");

  const [openEdit, setOpenEdit] = useState(false);
  const [form] = Form.useForm();

  // 获取当前用户管理的党组织信息
  async function fetchMyOrg() {
    try {
      setLoading(true);

      var addr = "";
      try {
        addr = localStorage.getItem("wallet_address") || "";
      } catch (e) {
        addr = "";
      }
      addr = String(addr || "").trim();
      setWalletAddress(addr);

      if (!addr) {
        setOrgId(null);
        setDetail(null);
        return;
      }

      // 根据钱包地址查询党组织
      var res = await listPartyOrgs({ keyword: addr, page: 1, pageSize: 20 });
      var items = (res && res.items) || [];
      if (!items.length) {
        setOrgId(null);
        setDetail(null);
        return;
      }

      var oid = items[0].org_id;
      setOrgId(oid);

      // 获取党组织详情
      var d = await getPartyOrgDetail(oid);
      setDetail(d || null);

      // 初始化表单数据（用于编辑时回填）
      if (d) {
        form.setFieldsValue({
          org_id: d.org_id,
          org_name: d.org_name,
          org_code: d.org_code,
          org_type: d.org_type,
          leader_name: d.leader_name,
          description: d.description,
          description_cid: d.description_cid,
          status: d.status,
        });
      }
    } catch (e) {
      console.error(e);
      message.error(e.message || "加载所管组织失败");
    } finally {
      setLoading(false);
    }
  }

  // 打开编辑弹框
  function handleOpenEdit() {
    if (!detail) return;
    // 表单数据已在 fetchMyOrg 中设置，这里直接打开弹框
    setOpenEdit(true);
  }

  // 保存修改
  async function handleSave() {
    try {
      const values = await form.validateFields();
      if (!values.org_id && orgId) values.org_id = orgId;

      var oid = parseInt(String(values.org_id || ""), 10);
      if (!Number.isFinite(oid) || oid <= 0) {
        throw new Error("org_id 无效，请刷新页面后重试");
      }

      setSaving(true);
      await updatePartyOrgOffchain(values);
      message.success("保存成功");
      setOpenEdit(false);
      await fetchMyOrg();
    } catch (e) {
      console.error(e);
      message.error(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    fetchMyOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PartyOrgLayout>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              所管组织
            </Title>
            <Text type="secondary">修改当前钱包地址所管党组织的链下信息。</Text>
          </div>
          <Space>
            <Button onClick={fetchMyOrg} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={handleOpenEdit} disabled={!detail}>
              修改
            </Button>
          </Space>
        </div>

        {!walletAddress ? (
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
            <Empty description="未检测到钱包地址，请先登录/连接钱包" />
          </Card>
        ) : !detail ? (
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }} loading={loading}>
            <Empty description="未找到该钱包所管的党组织（请确认系统管理员已绑定管理员地址）" />
          </Card>
        ) : (
          <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }} loading={loading}>
            <Descriptions size="middle" column={1} bordered>
              <Descriptions.Item label="党组织名称">{detail.org_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="党组织编码">{detail.org_code || "-"}</Descriptions.Item>
              <Descriptions.Item label="党组织类型">{detail.org_type || "-"}</Descriptions.Item>
              <Descriptions.Item label="负责人姓名">{detail.leader_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="组织简介">{detail.description || "-"}</Descriptions.Item>
              <Descriptions.Item label="简介 CID">{detail.description_cid || "-"}</Descriptions.Item>
              <Descriptions.Item label="管理员地址">
                <Text code>{detail.orger_address || walletAddress || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="区块高度">{detail.block_height || "-"}</Descriptions.Item>
              <Descriptions.Item label="交易哈希">
                <Text code copyable={!!detail.transaction_hash}>
                  {detail.transaction_hash || "-"}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detail.created_at ? formatDateTime(detail.created_at) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Modal
          title={detail ? `修改所管组织：${detail.org_name}` : "修改所管组织"}
          open={openEdit}
          onCancel={() => {
            if (saving) return;
            setOpenEdit(false);
          }}
          onOk={handleSave}
          confirmLoading={saving}
          okText="修改"
          cancelText="取消"
          width={640}
          destroyOnClose={false}
        >
          <Form form={form} layout="vertical" preserve={true}>
            <Form.Item name="org_id" hidden>
              <Input />
            </Form.Item>

            <Form.Item label="党组织名称" name="org_name" rules={[{ required: true, message: "请输入党组织名称" }]}>
              <Input maxLength={200} />
            </Form.Item>

            <Form.Item label="党组织编码" name="org_code" rules={[{ required: true, message: "请输入党组织编码" }]}>
              <Input maxLength={100} />
            </Form.Item>

            <Form.Item label="党组织类型" name="org_type">
              <Input maxLength={100} />
            </Form.Item>

            <Form.Item label="负责人姓名" name="leader_name">
              <Input maxLength={100} />
            </Form.Item>

            <Form.Item label="组织简介" name="description">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item label="简介 CID" name="description_cid">
              <Input maxLength={200} />
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
              <Input value={(detail && detail.orger_address) || walletAddress || ""} disabled />
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </PartyOrgLayout>
  );
}
