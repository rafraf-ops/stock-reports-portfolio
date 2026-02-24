import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function FinancialChart({ data, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">אין מספיק נתונים להצגת גרף</p>
      </div>
    );
  }
  
  // Format data for chart
  const chartData = data.map(item => ({
    quarter: item.quarter || `${item.fiscal_quarter}/${item.fiscal_year}`,
    revenue: item.revenue ? item.revenue / 1000000000 : 0,
    netIncome: item.net_income ? item.net_income / 1000000000 : 0,
  })).reverse();
  
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="quarter" 
            tick={{ fontSize: 12 }}
            reversed={true} // RTL support
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'מיליארד דולר', angle: -90, position: 'insideRight' }}
          />
          <Tooltip 
            formatter={(value) => [`$${value.toFixed(2)}B`, '']}
            labelStyle={{ direction: 'rtl' }}
          />
          <Legend 
            wrapperStyle={{ direction: 'rtl' }}
          />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            stroke="#0ea5e9" 
            strokeWidth={2}
            name="הכנסות"
            dot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="netIncome" 
            stroke="#10b981" 
            strokeWidth={2}
            name="רווח נקי"
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
