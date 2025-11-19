import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Users, Activity } from 'lucide-react';
import AnalyticsCharts from '../components/analytics/AnalyticsCharts';
import RecentTransactionsTable from '../components/analytics/RecentTransactionsTable';
import { statsService } from '../api/services';

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(undefined, options).format(value);

const formatPercentageChange = (change: number) => {
  if (!Number.isFinite(change)) {
    return '0%';
  }

  const rounded = Number(change.toFixed(2));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
};

export default function Dashboard() {
  const { startISO, endISO } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  }, []);

  const {
    data: dashboardStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => statsService.getDashboardStats(),
  });

  const {
    data: revenueSummary,
    isLoading: revenueLoading,
  } = useQuery({
    queryKey: ['admin-revenue-summary', startISO, endISO],
    queryFn: () => statsService.getRevenueSummary({ startDate: startISO, endDate: endISO }),
  });

  const {
    data: transactionSummary,
    isLoading: transactionLoading,
  } = useQuery({
    queryKey: ['admin-transaction-summary', startISO, endISO],
    queryFn: () => statsService.getTransactionSummary({ startDate: startISO, endDate: endISO }),
  });

  const statsCards = useMemo(() => {
    if (!dashboardStats) {
      return [
        { name: 'Total Revenue (TON)', value: '--', change: '--', icon: DollarSign },
        { name: 'Total Transactions', value: '--', change: '--', icon: Activity },
        { name: 'Active Merchants', value: '--', change: '--', icon: Users },
        { name: 'Success Rate', value: '--', change: '--', icon: TrendingUp },
      ];
    }

    return [
      {
        name: 'Total Revenue (TON)',
        value: `${formatNumber(dashboardStats.totalRevenueTon, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TON`,
        change: formatPercentageChange(dashboardStats.revenueChange),
        icon: DollarSign,
      },
      {
        name: 'Total Transactions',
        value: formatNumber(dashboardStats.totalTransactions),
        change: formatPercentageChange(dashboardStats.transactionChange),
        icon: Activity,
      },
      {
        name: 'Active Merchants',
        value: formatNumber(dashboardStats.activeMerchants),
        change: formatPercentageChange(dashboardStats.activeMerchantsChange),
        icon: Users,
      },
      {
        name: 'Success Rate',
        value: `${formatNumber(dashboardStats.successRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
        change: formatPercentageChange(dashboardStats.successRateChange),
        icon: TrendingUp,
      },
    ];
  }, [dashboardStats]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {statsError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Unable to load dashboard stats. Please verify your API key and try again.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <span
                className={`text-sm font-medium ${stat.change.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}
              >
                {statsLoading ? '...' : stat.change}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {statsLoading ? '--' : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <AnalyticsCharts
        revenueData={revenueSummary}
        transactionData={transactionSummary}
        loading={revenueLoading || transactionLoading}
      />

      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        <RecentTransactionsTable />
      </div>
    </div>
  );
}
