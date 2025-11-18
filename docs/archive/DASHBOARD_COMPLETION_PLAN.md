# Dashboard Completion Plan

## Current State Analysis

### ✅ What's Already Built

**Structure:**
- ✅ React 18 + TypeScript + Vite setup
- ✅ Basic routing with react-router-dom
- ✅ 3 main pages: Dashboard, Transactions, Settings
- ✅ Layout components (Header, Sidebar, Layout)
- ✅ Mock data and static UI components
- ✅ Tailwind CSS styling (configured in root)
- ✅ Lucide icons for UI elements

**Pages:**
- ✅ Dashboard: Stats cards, charts placeholder, recent transactions
- ✅ Transactions: Filterable/sortable transaction list
- ✅ Settings: API key management (mock)

**Components:**
- ✅ AnalyticsCharts: Uses recharts for revenue/transaction visualization
- ✅ RecentTransactionsTable: Basic transaction display
- ✅ Sidebar: Navigation with icons
- ✅ Header: Search bar and notifications

### ❌ What's Missing

**Critical:**
1. **Missing Dependencies**: `react-router-dom`, `recharts`, `lucide-react` not in package.json
2. **No API Integration**: All data is hardcoded mock data
3. **No Authentication**: No login/logout, no token management
4. **No Real-time Updates**: Static data, no websockets or polling
5. **No Error Handling**: No error boundaries or toast notifications

**Important:**
6. **No Loading States**: No spinners or skeletons
7. **No Pagination**: Transaction lists need pagination
8. **No Data Validation**: Forms don't validate input
9. **No Environment Config**: No .env support for API URLs
10. **Incomplete Features**:
    - P2P order management
    - DEX liquidity visualization
    - Conversion tracking
    - Webhook management
    - Fee collection analytics

**Nice-to-Have:**
11. No dark mode
12. No responsive mobile optimization
13. No export functionality (CSV, PDF)
14. No date range pickers
15. No advanced filtering

---

## Implementation Plan (6 Phases)

### Phase 1: Fix Dependencies & Setup (Week 1)
**Goal**: Make the dashboard actually run without errors

#### 1.1 Install Missing Dependencies
```bash
cd packages/dashboard
npm install react-router-dom lucide-react recharts
npm install -D @types/recharts
```

#### 1.2 Create API Client
**File**: `src/api/client.ts`
```typescript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('apiKey');
  if (token) {
    config.headers['x-api-key'] = token;
  }
  return config;
});

// Handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('apiKey');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### 1.3 Environment Configuration
**File**: `packages/dashboard/.env.example`
```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

#### 1.4 Type Definitions
**File**: `src/types/index.ts`
```typescript
export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'received' | 'converting' | 'settled' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface Conversion {
  id: string;
  paymentId: string;
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  rate: number;
  status: string;
  dexProvider?: 'dedust' | 'stonfi' | 'p2p';
  dexTxHash?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  apiKey: string;
  webhookUrl?: string;
  createdAt: string;
}

export interface Stats {
  totalRevenue: number;
  totalTransactions: number;
  activeUsers: number;
  successRate: number;
  revenueChange: number;
  transactionChange: number;
  userChange: number;
  successRateChange: number;
}

export interface P2POrder {
  id: string;
  type: 'buy' | 'sell';
  userId: string;
  starsAmount: number;
  tonAmount: string;
  rate: string;
  status: 'open' | 'matched' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface DexQuote {
  provider: 'dedust' | 'stonfi';
  rate: number;
  liquidityUsd: number;
  priceImpact: number;
  estimatedGas: number;
}
```

---

### Phase 2: API Integration (Week 2)
**Goal**: Connect dashboard to real backend API

#### 2.1 API Service Layer
**File**: `src/api/services.ts`
```typescript
import { apiClient } from './client';
import { Payment, Conversion, User, Stats, P2POrder, DexQuote } from '../types';

export const paymentService = {
  async getPayments(params?: { limit?: number; offset?: number; status?: string }) {
    const { data } = await apiClient.get<{ success: boolean; data: Payment[] }>('/payments', { params });
    return data.data;
  },
  
  async getPayment(id: string) {
    const { data } = await apiClient.get<{ success: boolean; data: Payment }>(`/payments/${id}`);
    return data.data;
  },
};

export const conversionService = {
  async getConversions(params?: { limit?: number; offset?: number }) {
    const { data } = await apiClient.get<{ success: boolean; data: Conversion[] }>('/conversions', { params });
    return data.data;
  },
  
  async getConversion(id: string) {
    const { data } = await apiClient.get<{ success: boolean; data: Conversion }>(`/conversions/${id}`);
    return data.data;
  },
};

export const userService = {
  async getProfile() {
    const { data } = await apiClient.get<{ success: boolean; data: User }>('/user/profile');
    return data.data;
  },
  
  async updateWebhookUrl(webhookUrl: string) {
    const { data } = await apiClient.patch<{ success: boolean; data: User }>('/user/webhook', { webhookUrl });
    return data.data;
  },
  
  async regenerateApiKey() {
    const { data } = await apiClient.post<{ success: boolean; data: { apiKey: string } }>('/user/regenerate-key');
    return data.data;
  },
};

export const statsService = {
  async getDashboardStats() {
    const { data } = await apiClient.get<{ success: boolean; data: Stats }>('/admin/stats');
    return data.data;
  },
  
  async getRevenueChart(days: number = 7) {
    const { data } = await apiClient.get('/admin/charts/revenue', { params: { days } });
    return data.data;
  },
  
  async getTransactionChart(days: number = 7) {
    const { data } = await apiClient.get('/admin/charts/transactions', { params: { days } });
    return data.data;
  },
};

export const p2pService = {
  async getOrders(params?: { type?: 'buy' | 'sell'; status?: string }) {
    const { data } = await apiClient.get<{ success: boolean; data: P2POrder[] }>('/p2p/orders', { params });
    return data.data;
  },
  
  async createOrder(order: { type: 'buy' | 'sell'; starsAmount: number; rate: string }) {
    const { data } = await apiClient.post<{ success: boolean; data: P2POrder }>('/p2p/orders', order);
    return data.data;
  },
};

export const dexService = {
  async getQuote(fromCurrency: string, toCurrency: string, amount: number) {
    const { data } = await apiClient.get<{ success: boolean; data: DexQuote }>('/dex/quote', {
      params: { fromCurrency, toCurrency, amount },
    });
    return data.data;
  },
  
  async getLiquidity(fromCurrency: string, toCurrency: string, amount: number) {
    const { data } = await apiClient.get('/dex/liquidity', {
      params: { fromCurrency, toCurrency, amount },
    });
    return data.data;
  },
};
```

#### 2.2 React Query Setup (Optional but Recommended)
```bash
npm install @tanstack/react-query
```

**File**: `src/api/queryClient.ts`
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});
```

#### 2.3 Update Dashboard Page with Real Data
**File**: `src/pages/Dashboard.tsx`
```typescript
import { useQuery } from '@tanstack/react-query';
import { statsService } from '../api/services';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsService.getDashboardStats,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  // ... rest of component
}
```

---

### Phase 3: Authentication & Security (Week 3)
**Goal**: Add proper login/logout and API key management

#### 3.1 Auth Context
**File**: `src/context/AuthContext.tsx`
```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { userService } from '../api/services';

interface AuthContextType {
  user: User | null;
  apiKey: string | null;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('apiKey'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (apiKey) {
      userService.getProfile()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('apiKey');
          setApiKey(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [apiKey]);

  const login = async (key: string) => {
    localStorage.setItem('apiKey', key);
    setApiKey(key);
    const profile = await userService.getProfile();
    setUser(profile);
  };

  const logout = () => {
    localStorage.removeItem('apiKey');
    setApiKey(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, apiKey, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

#### 3.2 Login Page
**File**: `src/pages/Login.tsx`
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Key } from 'lucide-react';

export default function Login() {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(apiKey);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Invalid API key');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-100 rounded-full">
            <Key className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">TG Payment Gateway</h1>
        <p className="text-gray-600 text-center mb-6">Enter your API key to continue</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="pk_..."
            className="w-full px-4 py-3 border rounded-lg mb-4 font-mono text-sm"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 3.3 Protected Route Component
**File**: `src/components/common/ProtectedRoute.tsx`
```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { apiKey, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!apiKey) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}
```

---

### Phase 4: New Features & Pages (Week 4-5)
**Goal**: Add P2P orders, DEX analytics, and webhook management

#### 4.1 P2P Orders Page
**File**: `src/pages/P2POrders.tsx`
```typescript
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { p2pService } from '../api/services';
import { Plus } from 'lucide-react';

export default function P2POrders() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: orders, isLoading } = useQuery({
    queryKey: ['p2p-orders'],
    queryFn: () => p2pService.getOrders(),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">P2P Orders</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Create Order
        </button>
      </div>
      
      {/* Orders table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stars</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TON</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {orders?.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    order.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {order.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">{order.starsAmount.toLocaleString()}</td>
                <td className="px-6 py-4">{order.tonAmount} TON</td>
                <td className="px-6 py-4 font-mono text-sm">{order.rate}</td>
                <td className="px-6 py-4">{order.status}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### 4.2 DEX Analytics Page
**File**: `src/pages/DexAnalytics.tsx`
```typescript
import { useQuery } from '@tanstack/react-query';
import { dexService } from '../api/services';
import { TrendingUp, Zap } from 'lucide-react';

export default function DexAnalytics() {
  const { data: liquidity } = useQuery({
    queryKey: ['dex-liquidity'],
    queryFn: () => dexService.getLiquidity('STARS', 'TON', 1000),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">DEX Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold">DeDust Pool</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Liquidity (USD)</span>
              <span className="font-semibold">${liquidity?.sources[0]?.liquidityUsd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Rate</span>
              <span className="font-semibold font-mono">{liquidity?.sources[0]?.rate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">24h Volume</span>
              <span className="font-semibold">$45,231</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold">Ston.fi Pool</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Liquidity (USD)</span>
              <span className="font-semibold">${liquidity?.sources[1]?.liquidityUsd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Rate</span>
              <span className="font-semibold font-mono">{liquidity?.sources[1]?.rate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">24h Volume</span>
              <span className="font-semibold">$38,492</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### 4.3 Webhooks Management Page
**File**: `src/pages/Webhooks.tsx`
```typescript
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { userService } from '../api/services';
import { Webhook, CheckCircle, XCircle } from 'lucide-react';

export default function Webhooks() {
  const { data: user } = useQuery({
    queryKey: ['user-profile'],
    queryFn: userService.getProfile,
  });

  const [webhookUrl, setWebhookUrl] = useState(user?.webhookUrl || '');

  const updateWebhook = useMutation({
    mutationFn: userService.updateWebhookUrl,
    onSuccess: () => {
      // Show success toast
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Webhook Configuration</h1>
      
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Webhook className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold">Webhook URL</h2>
        </div>
        
        <p className="text-gray-600 text-sm mb-4">
          Configure where payment and conversion events should be sent
        </p>
        
        <div className="space-y-4">
          <input
            type="url"
            placeholder="https://your-domain.com/webhooks"
            className="w-full px-4 py-2 border rounded-lg"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          
          <button
            onClick={() => updateWebhook.mutate(webhookUrl)}
            disabled={updateWebhook.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateWebhook.isPending ? 'Saving...' : 'Save Webhook URL'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold mb-3">Recent Webhook Deliveries</h3>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">payment.received</p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                  </div>
                </div>
                <span className="text-xs text-green-600 font-medium">200 OK</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 5: UI/UX Improvements (Week 6)
**Goal**: Polish the interface with loading states, error handling, and responsiveness

#### 5.1 Common Components
**Files to create:**
- `src/components/common/LoadingSpinner.tsx`
- `src/components/common/ErrorMessage.tsx`
- `src/components/common/Toast.tsx`
- `src/components/common/Modal.tsx`
- `src/components/common/ConfirmDialog.tsx`
- `src/components/common/EmptyState.tsx`
- `src/components/common/Pagination.tsx`

#### 5.2 Toast Notifications
```bash
npm install react-hot-toast
```

**File**: `src/components/common/Toast.tsx`
```typescript
import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#fff',
          color: '#363636',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}
```

#### 5.3 Skeleton Loaders
**File**: `src/components/common/Skeleton.tsx`
```typescript
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="h-6 w-6 bg-gray-200 rounded mb-4"></div>
      <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
      <div className="h-8 w-32 bg-gray-200 rounded"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
      ))}
    </div>
  );
}
```

#### 5.4 Responsive Design Improvements
Update Sidebar.tsx to be mobile-friendly with hamburger menu.

---

### Phase 6: Testing & Deployment (Week 7)
**Goal**: Test everything and prepare for production

#### 6.1 Add Vitest for Testing
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom happy-dom
```

**File**: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

#### 6.2 Write Tests
- API service tests
- Component unit tests
- Integration tests for critical flows

#### 6.3 Production Build
```bash
npm run build
npm run preview
```

#### 6.4 Docker Support
**File**: `packages/dashboard/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Priority Matrix

### Must Have (MVP)
1. ✅ Install missing dependencies (react-router-dom, recharts, lucide-react)
2. ✅ Create API client with axios
3. ✅ Add authentication (Login page + AuthContext)
4. ✅ Connect Dashboard to real API endpoints
5. ✅ Connect Transactions page to real data
6. ✅ Fix Settings page to use real API key management
7. ✅ Add loading states and error handling

### Should Have (Phase 2)
8. P2P Orders page
9. DEX Analytics page
10. Webhooks management page
11. Toast notifications
12. Pagination for transaction lists
13. Real-time updates with WebSocket

### Nice to Have (Future)
14. Dark mode toggle
15. Export to CSV/PDF
16. Advanced filtering with date ranges
17. Mobile app support
18. Multi-language support

---

## File Structure After Completion

```
packages/dashboard/
├── src/
│   ├── api/
│   │   ├── client.ts              # Axios instance + interceptors
│   │   ├── queryClient.ts         # React Query setup
│   │   └── services.ts            # API service methods
│   ├── components/
│   │   ├── analytics/
│   │   │   ├── AnalyticsCharts.tsx
│   │   │   └── RecentTransactionsTable.tsx
│   │   ├── common/
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── pages/
│   │   ├── Login.tsx              # NEW
│   │   ├── Dashboard.tsx          # Updated with API
│   │   ├── Transactions.tsx       # Updated with API
│   │   ├── Settings.tsx           # Updated with API
│   │   ├── P2POrders.tsx          # NEW
│   │   ├── DexAnalytics.tsx       # NEW
│   │   └── Webhooks.tsx           # NEW
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── App.tsx                    # Updated with auth routes
│   ├── main.tsx
│   └── index.css
├── .env.example
├── Dockerfile
├── nginx.conf
└── package.json                   # Updated dependencies
```

---

## Estimated Timeline

- **Week 1**: Dependencies + API Client + Types → **Working foundation**
- **Week 2**: API Integration for existing pages → **Real data flowing**
- **Week 3**: Authentication system → **Secure access**
- **Week 4**: P2P Orders + DEX Analytics pages → **Feature complete**
- **Week 5**: Webhooks + UI polish → **Production ready**
- **Week 6**: Testing + Documentation → **Launch ready**

---

## Next Steps

1. **Start with Phase 1.1**: Install dependencies and verify dashboard runs
2. **Create API client**: Set up axios instance with auth interceptors
3. **Add type definitions**: Create comprehensive TypeScript interfaces
4. **Connect one page**: Start with Dashboard page API integration
5. **Add authentication**: Implement login flow before going further

Run this to get started:
```bash
cd packages/dashboard
npm install react-router-dom lucide-react recharts @tanstack/react-query react-hot-toast
npm install -D @types/recharts
npm run dev
```
