'use client'

import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const lineData = [
  { month: 'Jan', tickets: 400, resolved: 350 },
  { month: 'Feb', tickets: 450, resolved: 380 },
  { month: 'Mar', tickets: 520, resolved: 470 },
  { month: 'Apr', tickets: 480, resolved: 440 },
  { month: 'May', tickets: 550, resolved: 510 },
  { month: 'Jun', tickets: 600, resolved: 560 },
];

const barData = [
  { category: 'Hardware', count: 145 },
  { category: 'Software', count: 230 },
  { category: 'Network', count: 178 },
  { category: 'Access', count: 95 },
  { category: 'Other', count: 120 },
];

const pieData = [
  { name: 'Open', value: 234 },
  { name: 'In Progress', value: 156 },
  { name: 'Resolved', value: 487 },
  { name: 'Closed', value: 312 },
];

const COLORS = {
  primary: '#4C8B40',
  secondary: '#FDCE0D',
  info: '#3b82f6',
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#22c55e',
};

const PIE_COLORS = ['#4C8B40', '#FDCE0D', '#3b82f6', '#f59e0b'];

export function DataVisualizationShowcase() {
  return (
    <div className="space-y-8">
      {/* Chart Colors Reference */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Chart Color Palette</h4>
        <div className="flex gap-4">
          {Object.entries(COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded" style={{ backgroundColor: color }}></div>
              <div>
                <div className="text-sm font-medium capitalize">{name}</div>
                <div className="text-xs text-neutral-500 font-mono">{color}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Line Chart */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Line Chart</h4>
        <div className="bg-white p-6 rounded-lg border border-neutral-200">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="tickets"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ fill: COLORS.primary, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke={COLORS.secondary}
                strokeWidth={2}
                dot={{ fill: COLORS.secondary, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Bar Chart</h4>
        <div className="bg-white p-6 rounded-lg border border-neutral-200">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Area Chart */}
      <div>
        <h4 className="font-semibold text-neutral-900 mb-4">Area Chart</h4>
        <div className="bg-white p-6 rounded-lg border border-neutral-200">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="tickets"
                stroke={COLORS.primary}
                fill={COLORS.primary}
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="resolved"
                stroke={COLORS.secondary}
                fill={COLORS.secondary}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie & Donut Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-neutral-900 mb-4">Pie Chart</h4>
          <div className="bg-white p-6 rounded-lg border border-neutral-200">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-neutral-900 mb-4">Donut Chart</h4>
          <div className="bg-white p-6 rounded-lg border border-neutral-200">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Guidelines */}
      <div className="bg-neutral-50 p-6 rounded-lg">
        <h4 className="font-semibold text-neutral-900 mb-4">Chart Guidelines</h4>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Use consistent colors across all charts - primary green for main data, secondary yellow for comparisons</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Always include tooltips for interactive data exploration</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Use clear, readable labels and legends positioned appropriately</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Maintain consistent spacing and padding within chart containers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Use white backgrounds with subtle borders for chart containers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5">•</span>
            <span>Keep grid lines subtle using neutral-200 color (#e5e7eb)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
