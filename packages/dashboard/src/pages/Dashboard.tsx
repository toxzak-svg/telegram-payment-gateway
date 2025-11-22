
import { DollarSign, TrendingUp, Users, Activity } from 'lucide-react';
import AnalyticsCharts from '../components/analytics/AnalyticsCharts';
import RecentTransactionsTable from '../components/analytics/RecentTransactionsTable';

export default function Dashboard() {
  const stats = [
    { name: 'Total Revenue', value: '$45,231', change: '+12.5%', icon: DollarSign, trend: 'up' },
    { name: 'Transactions', value: '2,345', change: '+8.2%', icon: Activity, trend: 'up' },
    { name: 'Active Users', value: '1,234', change: '+23.1%', icon: Users, trend: 'up' },
    { name: 'Success Rate', value: '98.5%', change: '+2.3%', icon: TrendingUp, trend: 'up' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <span className="text-sm font-medium text-green-600">{stat.change}</span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">{stat.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics charts */}
      <AnalyticsCharts />

      {/* Recent transactions table */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        <RecentTransactionsTable />
      </div>
    </div>
  );
}
