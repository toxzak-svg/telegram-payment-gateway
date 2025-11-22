import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { userService } from '../api/services';

interface AuthContextType {
  user: User | null;
  apiKey: string | null;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(
    localStorage.getItem('apiKey')
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (apiKey) {
        try {
          const profile = await userService.getProfile();
          setUser(profile);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          localStorage.removeItem('apiKey');
          setApiKey(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, [apiKey]);

  const login = async (key: string) => {
    console.log('[AuthContext] Attempting login with key:', key);
    localStorage.setItem('apiKey', key);
    setApiKey(key);
    try {
      const profile = await userService.getProfile();
      setUser(profile);
    } catch (error) {
      localStorage.removeItem('apiKey');
      setApiKey(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('apiKey');
    setApiKey(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        apiKey,
        login,
        logout,
        isLoading,
        isAuthenticated: !!apiKey && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
