import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const revenueData = [
  { date: 'Nov 1', revenue: 1200 },
  { date: 'Nov 2', revenue: 2100 },
  { date: 'Nov 3', revenue: 800 },
  { date: 'Nov 4', revenue: 1600 },
  { date: 'Nov 5', revenue: 900 },
  { date: 'Nov 6', revenue: 1700 },
  { date: 'Nov 7', revenue: 2500 },
];

const txData = [
  { date: 'Nov 1', count: 32 },
  { date: 'Nov 2', count: 45 },
  { date: 'Nov 3', count: 21 },
  { date: 'Nov 4', count: 38 },
  { date: 'Nov 5', count: 27 },
  { date: 'Nov 6', count: 41 },
  { date: 'Nov 7', count: 56 },
];

export default function AnalyticsCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={revenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Transactions (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={txData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#22c55e" barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
