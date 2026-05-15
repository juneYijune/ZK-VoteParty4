"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Spin } from 'antd';
import { useAuth } from '@/contexts/AuthContext';

// 路由角色映射
const ROUTE_ROLES = {
  '/admin': ['SYSTEM_ADMIN'],
  '/partyorg': ['PARTY_ORG_ADMIN'],
  '/user': ['USER', 'PARTY_ORG_ADMIN'],
};

// 公开路由
const PUBLIC_ROUTES = ['/login', '/'];

export function RouteGuard({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // 公开路由直接放行
    if (PUBLIC_ROUTES.some(route => pathname === route)) {
      return;
    }

    // 未登录重定向到登录页
    if (!isAuthenticated) {
      // 使用完整页面跳转
      window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
      return;
    }

    // 检查角色权限
    for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
      if (pathname.startsWith(routePrefix)) {
        if (!allowedRoles.includes(user.role)) {
          // 使用完整页面跳转
          window.location.href = '/login?error=unauthorized';
          return;
        }
        break;
      }
    }
  }, [user, loading, isAuthenticated, pathname, router]);

  // 加载中显示 loading
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 公开路由直接渲染
  if (PUBLIC_ROUTES.some(route => pathname === route)) {
    return children;
  }

  // 已认证且有权限才渲染
  if (isAuthenticated) {
    return children;
  }

  // 其他情况显示 loading（等待重定向）
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh' 
    }}>
      <Spin size="large" />
    </div>
  );
}
