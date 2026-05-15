"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 从 cookie 加载用户信息
  useEffect(() => {
    const userCookie = Cookies.get('user');
    if (userCookie) {
      try {
        const userData = JSON.parse(userCookie);
        setUser(userData);
      } catch (e) {
        console.error('Failed to parse user cookie:', e);
        Cookies.remove('user');
      }
    }
    setLoading(false);
  }, []);

  // 登录
  const login = (userData) => {
    setUser(userData);
    // 设置 cookie，7天过期，path 设置为根路径确保全站可用
    Cookies.set('user', JSON.stringify(userData), { 
      expires: 7,
      path: '/',
      sameSite: 'lax'
    });
  };

  // 登出
  const logout = () => {
    // 立即清除状态
    setUser(null);
    
    // 清除 Cookie（多种方式确保删除）
    Cookies.remove('user', { path: '/' });
    Cookies.remove('user');
    document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'user=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    // 清除 localStorage
    try {
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('wallet_login_at');
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
    
    // 延迟后完整页面跳转，确保所有清除操作完成
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  };

  // 更新用户信息
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    Cookies.set('user', JSON.stringify(updatedUser), { 
      expires: 7,
      path: '/',
      sameSite: 'lax'
    });
  };

  // 检查角色权限
  const hasRole = (roles) => {
    if (!user) return false;
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    return user.role === roles;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    hasRole,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
