# 路由保护实现指南

## 概述

本系统实现了完整的路由保护机制，包括：
- 用户登录状态验证
- 基于角色的访问控制（RBAC）
- 服务端和客户端双重保护
- 自动重定向到登录页

## 架构

### 1. 认证上下文 (AuthContext)

位置：`frontend/contexts/AuthContext.js`

提供全局认证状态管理：
- `user`: 当前用户信息（包含 address 和 role）
- `isAuthenticated`: 是否已登录
- `login(userData)`: 登录方法
- `logout()`: 登出方法
- `updateUser(updates)`: 更新用户信息
- `hasRole(roles)`: 检查角色权限

用户信息存储在 Cookie 中，有效期 7 天。

### 2. 服务端中间件 (Middleware)

位置：`frontend/middleware.js`

在服务端拦截所有路由请求，执行以下检查：
1. 检查是否是公开路由（`/login`, `/`）
2. 验证用户是否已登录（检查 Cookie）
3. 验证用户角色是否有权限访问该路由
4. 未通过验证则重定向到登录页

### 3. 客户端路由守卫 (RouteGuard)

位置：`frontend/components/RouteGuard.js`

在客户端进行二次验证：
- 加载时显示 loading 状态
- 检查认证状态和角色权限
- 未通过验证则重定向到登录页

## 角色权限配置

### 角色定义

位置：`frontend/constants/roles.js`

```javascript
export const Roles = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",        // 系统管理员
  PARTY_ORG_ADMIN: "PARTY_ORG_ADMIN",  // 党组织管理员
  USER: "USER"                          // 普通用户（党员）
};
```

### 路由权限映射

在 `middleware.js` 和 `RouteGuard.js` 中配置：

```javascript
const ROUTE_ROLES = {
  '/admin': ['SYSTEM_ADMIN'],                    // 仅系统管理员
  '/partyorg': ['PARTY_ORG_ADMIN'],              // 仅党组织管理员
  '/user': ['USER', 'PARTY_ORG_ADMIN'],          // 用户和党组织管理员
};
```

## 使用方法

### 1. 在组件中使用认证上下文

```javascript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout, hasRole } = useAuth();

  // 检查是否登录
  if (!isAuthenticated) {
    return <div>请先登录</div>;
  }

  // 检查角色
  if (!hasRole('SYSTEM_ADMIN')) {
    return <div>权限不足</div>;
  }

  // 显示用户信息
  return (
    <div>
      <p>地址: {user.address}</p>
      <p>角色: {user.role}</p>
      <button onClick={logout}>退出登录</button>
    </div>
  );
}
```

### 2. 登录流程

在 `frontend/app/login/page.js` 中：

```javascript
import { useAuth } from '@/contexts/AuthContext';
import { Roles } from '@/constants/roles';

function LoginPage() {
  const { login } = useAuth();

  async function handleLogin() {
    // ... MetaMask 签名验证 ...
    
    // 确定用户角色
    let userRole = Roles.USER;
    if (addr === adminAddress) {
      userRole = Roles.SYSTEM_ADMIN;
    } else if (isPartyOrgAdmin) {
      userRole = Roles.PARTY_ORG_ADMIN;
    }

    // 保存用户信息
    login({
      address: addr,
      role: userRole,
      loginAt: Date.now(),
    });

    // 重定向到相应页面
    router.push(redirectPath);
  }
}
```

### 3. 登出流程

在布局组件中：

```javascript
import { useAuth } from '@/contexts/AuthContext';

function MyLayout() {
  const { logout } = useAuth();

  function handleLogout() {
    logout(); // 自动清除 Cookie 并重定向到登录页
    message.success('已退出登录');
  }
}
```

## 安全特性

### 1. 双重验证

- **服务端中间件**：在请求到达页面前验证，防止直接访问路由
- **客户端守卫**：在组件渲染前验证，提供更好的用户体验

### 2. Cookie 安全

- 使用 `js-cookie` 库管理 Cookie
- 设置 7 天过期时间
- 存储用户地址和角色信息

### 3. 重定向保护

- 未登录访问受保护路由时，保存原始 URL
- 登录成功后自动跳转回原始页面
- 角色不匹配时显示错误提示

## 测试场景

### 1. 未登录访问受保护路由

```
访问: /admin
结果: 重定向到 /login?redirect=/admin
```

### 2. 角色不匹配

```
用户角色: USER
访问: /admin
结果: 重定向到 /login?error=unauthorized
提示: "您没有权限访问该页面"
```

### 3. 正常访问

```
用户角色: SYSTEM_ADMIN
访问: /admin
结果: 正常显示管理员页面
```

### 4. 登录后重定向

```
1. 未登录访问 /user/votes
2. 重定向到 /login?redirect=/user/votes
3. 登录成功后自动跳转到 /user/votes
```

## 扩展路由保护

### 添加新的受保护路由

在 `middleware.js` 和 `RouteGuard.js` 中更新 `ROUTE_ROLES`：

```javascript
const ROUTE_ROLES = {
  '/admin': ['SYSTEM_ADMIN'],
  '/partyorg': ['PARTY_ORG_ADMIN'],
  '/user': ['USER', 'PARTY_ORG_ADMIN'],
  '/new-route': ['SYSTEM_ADMIN', 'PARTY_ORG_ADMIN'], // 新路由
};
```

### 添加新角色

1. 在 `frontend/constants/roles.js` 中添加角色定义
2. 在登录逻辑中添加角色判断
3. 在路由权限映射中配置该角色的访问权限

## 注意事项

1. **保持一致性**：确保 `middleware.js` 和 `RouteGuard.js` 中的路由配置一致
2. **公开路由**：不需要登录的路由要添加到 `PUBLIC_ROUTES` 数组
3. **角色检查**：使用 `hasRole()` 方法检查权限，支持单个角色或角色数组
4. **Cookie 同步**：登录和登出时会自动同步 Cookie 和 localStorage

## 依赖

- `js-cookie`: Cookie 管理
- `next/navigation`: Next.js 路由
- `antd`: UI 组件（Spin, Modal 等）

## 兼容性

- 兼容现有的 localStorage 存储方式
- 登录时同时更新 Cookie 和 localStorage
- 支持从 Cookie 或 localStorage 恢复用户状态
