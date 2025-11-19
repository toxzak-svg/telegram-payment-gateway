import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { useMemo } from 'react';
import { RevenueSummaryEntry, TransactionSummaryEntry } from '../../types';

interface AnalyticsChartsProps {
  revenueData?: RevenueSummaryEntry[];
  transactionData?: TransactionSummaryEntry[];
  loading?: boolean;
}

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function AnalyticsCharts({
  revenueData,
  transactionData,
  loading = false,
}: AnalyticsChartsProps) {
  const revenueChartData = useMemo(() => {
    if (!revenueData) return [];

    return revenueData.map((entry) => ({
      date: formatDateLabel(entry.date),
      ton: entry.tonAmount ?? 0,
      stars: entry.starsAmount ?? 0,
    }));
  }, [revenueData]);

  const transactionChartData = useMemo(() => {
    if (!transactionData) return [];

    return transactionData.map((entry) => ({
      date: formatDateLabel(entry.date),
      total: entry.total ?? 0,
      completed: entry.completed ?? 0,
    }));
  }, [transactionData]);

  const showEmptyState = !loading && revenueChartData.length === 0 && transactionChartData.length === 0;

  if (showEmptyState) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center text-center text-gray-500 h-60">
          <p>No revenue data yet. Once you process payments, your earnings will appear here.</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center text-center text-gray-500 h-60">
          <p>No transactions yet. Initiate conversions to populate this chart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={revenueChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(value) => `${value.toFixed(2)} TON`} />
            <Tooltip formatter={(value: number) => `${value.toFixed(4)} TON`} />
            <Line type="monotone" dataKey="ton" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Transactions (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={transactionChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" name="Total" fill="#22c55e" barSize={32} />
            <Bar dataKey="completed" name="Completed" fill="#0ea5e9" barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
