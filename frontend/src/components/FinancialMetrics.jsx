import React from 'react';
import { formatCurrency, formatPercentage } from '../services/api';

export default function FinancialMetrics({ company, latestReport, metrics, reports }) {
  if (!latestReport) {
    return (
      <div className="bg-white rounded-xl shadow-md p-8">
        <p className="text-gray-500">אין נתונים פיננסיים זמינים</p>
      </div>
    );
  }

  // Calculate additional metrics
  const profitMargin = latestReport.revenue ? ((latestReport.net_income / latestReport.revenue) * 100).toFixed(2) : 0;
  const isProfitable = latestReport.net_income > 0;
  
  // Calculate year-over-year if we have enough data
  const yoyGrowth = reports.length >= 5 ? 
    ((latestReport.revenue - reports[4].revenue) / reports[4].revenue * 100).toFixed(2) : null;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="הכנסות רבעוניות"
          value={formatCurrency(latestReport.revenue)}
          change={metrics?.revenue_qoq}
          changeLabel="רבעון אחרון"
          icon="💰"
          color="blue"
        />
        
        <MetricCard
          title="רווח נקי"
          value={formatCurrency(latestReport.net_income)}
          change={metrics?.net_income_qoq}
          changeLabel="רבעון אחרון"
          icon="📊"
          color="green"
        />
        
        <MetricCard
          title="מרווח רווח"
          value={`${profitMargin}%`}
          subtitle={isProfitable ? 'רווחית ✅' : 'הפסדית ❌'}
          icon="📈"
          color="purple"
        />
        
        <MetricCard
          title="EPS"
          value={latestReport.eps ? `$${latestReport.eps.toFixed(2)}` : 'N/A'}
          subtitle={`Q${latestReport.fiscal_quarter} ${latestReport.fiscal_year}`}
          icon="💵"
          color="orange"
        />
      </div>

      {/* Detailed Financials */}
      <div className="bg-white rounded-xl shadow-md p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">פרטים פיננסיים מלאים</h3>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Income Statement */}
          <div>
            <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <span>📋</span> דוח רווח והפסד
            </h4>
            <div className="space-y-3">
              <FinancialRow label="הכנסות" value={formatCurrency(latestReport.revenue)} />
              <FinancialRow label="רווח גולמי" value={formatCurrency(latestReport.gross_profit)} />
              <FinancialRow label="רווח תפעולי" value={formatCurrency(latestReport.operating_income)} />
              <FinancialRow label="רווח נקי" value={formatCurrency(latestReport.net_income)} highlight />
              <FinancialRow label="EPS" value={latestReport.eps ? `$${latestReport.eps.toFixed(2)}` : 'N/A'} />
            </div>
          </div>

          {/* Balance Sheet */}
          <div>
            <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <span>🏦</span> מאזן
            </h4>
            <div className="space-y-3">
              <FinancialRow label="נכסים כוללים" value={formatCurrency(latestReport.total_assets)} />
              <FinancialRow label="התחייבויות" value={formatCurrency(latestReport.total_liabilities)} />
              <FinancialRow 
                label="הון עצמי" 
                value={formatCurrency(latestReport.shareholders_equity)} 
                highlight 
              />
              <FinancialRow 
                label="תזרים מזומנים תפעולי" 
                value={formatCurrency(latestReport.cash_flow_operating)} 
              />
            </div>
          </div>
        </div>

        {/* Growth Metrics */}
        {(metrics?.revenue_qoq || yoyGrowth) && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h4 className="font-bold text-lg text-gray-800 mb-4">📊 מדדי צמיחה</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics?.revenue_qoq && (
                <GrowthBadge label="צמיחה רבעונית" value={metrics.revenue_qoq} />
              )}
              {yoyGrowth && (
                <GrowthBadge label="צמיחה שנתית" value={yoyGrowth} />
              )}
              {metrics?.profit_margin && (
                <GrowthBadge label="מרווח רווח" value={metrics.profit_margin} showSign={false} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, changeLabel, subtitle, icon, color }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
      <div className={`bg-gradient-to-r ${colorClasses[color]} p-4 text-white`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-3xl font-bold">{value}</div>
      </div>
      <div className="p-4">
        {change && (
          <div className={`text-sm font-semibold ${parseFloat(change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {parseFloat(change) >= 0 ? '↑' : '↓'} {formatPercentage(change)} {changeLabel}
          </div>
        )}
        {subtitle && (
          <div className="text-sm text-gray-600 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function FinancialRow({ label, value, highlight }) {
  return (
    <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-gray-300 pt-3 font-bold' : ''}`}>
      <span className="text-gray-700">{label}</span>
      <span className={highlight ? 'text-lg text-gray-900' : 'text-gray-900'}>{value}</span>
    </div>
  );
}

function GrowthBadge({ label, value, showSign = true }) {
  const numValue = parseFloat(value);
  const isPositive = numValue >= 0;
  
  return (
    <div className={`rounded-lg p-4 text-center ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className={`text-xs mb-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>{label}</div>
      <div className={`text-2xl font-bold ${isPositive ? 'text-green-900' : 'text-red-900'}`}>
        {showSign && (isPositive ? '+' : '')}{numValue.toFixed(2)}%
      </div>
    </div>
  );
}