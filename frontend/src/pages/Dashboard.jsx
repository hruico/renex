import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';

const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2'];

function StatCard({ label, value, sub }) {
  return (
    <Card>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      <p className="text-2xl md:text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [utilization, setUtilization] = useState([]);
  const [popular, setPopular] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/utilization'),
      api.get('/analytics/popular'),
      api.get('/analytics/status-distribution'),
    ]).then(([s, u, p, d]) => {
      setSummary(s.data);
      setUtilization(u.data.utilization);
      setPopular(p.data.popular);
      setDistribution(d.data.distribution);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Assets" value={summary?.totalAssets} />
        <StatCard label="Active Bookings" value={summary?.activeBookings} />
        <StatCard label="Pending Approval" value={summary?.pendingCount} />
        <StatCard label="Overdue" value={summary?.overdueCount} sub={`${summary?.totalAvailableUnits} units available`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Volume */}
        <Card>
          <p className="text-sm font-medium mb-4">Booking Volume (Last 30 Days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={utilization}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Status Distribution */}
        <Card>
          <p className="text-sm font-medium mb-4">Booking Status Distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={distribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="55%"
                outerRadius={70}
                label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend iconType="circle" iconSize={10} formatter={(v) => v.replace('_', ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Assets */}
        <Card className="lg:col-span-2">
          <p className="text-sm font-medium mb-4">Top 10 Most Booked Assets</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={popular} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="asset.name" tick={{ fontSize: 10 }} width={110} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
