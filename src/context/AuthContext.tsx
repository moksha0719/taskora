import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { authApi } from '../lib/api/client';
import { ADMIN_USER, INITIAL_USER } from '../lib/mockData';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, role?: Role) => Promise<void>;
  register: (name: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  switchUserRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(INITIAL_USER);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    authApi.getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, role: Role = 'student') => {
    setLoading(true);
    const loggedIn = await authApi.login(email, role === 'admin' ? 'admin' : 'student');
    setUser(loggedIn);
    setLoading(false);
  };

  const register = async (name: string, email: string) => {
    setLoading(true);
    const newUser = await authApi.register(name, email);
    setUser(newUser);
    setLoading(false);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = await authApi.updateProfile(updates);
    setUser(updated);
  };

  const switchUserRole = (role: Role) => {
    if (role === 'admin') {
      setUser(ADMIN_USER);
    } else {
      setUser(INITIAL_USER);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        switchUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
