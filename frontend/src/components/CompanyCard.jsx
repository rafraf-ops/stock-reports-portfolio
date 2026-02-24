import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function CompanyCard({ company }) {
  const navigate = useNavigate();

  const getSectorColor = (sector) => {
    const colors = {
      'Technology': 'bg-blue-100 text-blue-800',
      'Healthcare': 'bg-green-100 text-green-800',
      'Financial': 'bg-purple-100 text-purple-800',
      'Consumer': 'bg-orange-100 text-orange-800',
      'Industrial': 'bg-gray-100 text-gray-800',
      'Energy': 'bg-yellow-100 text-yellow-800',
    };
    return colors[sector] || 'bg-gray-100 text-gray-800';
  };

  const formatMarketCap = (marketCap) => {
    if (!marketCap) return 'לא זמין';
    
    if (marketCap >= 1000000000000) {
      return `$${(marketCap / 1000000000000).toFixed(2)}T`;
    } else if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(2)}B`;
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`;
    }
    return `$${marketCap.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'לא זמין';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'לא זמין';
      return date.toLocaleDateString('he-IL');
    } catch (error) {
      return 'לא זמין';
    }
  };

  return (
    <div
      onClick={() => navigate(`/company/${company.symbol}`)}
      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 overflow-hidden transform hover:-translate-y-1"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{company.symbol}</h3>
            <p className="text-gray-600 text-sm line-clamp-2">{company.name || 'חברה'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSectorColor(company.sector)}`}>
            {company.sector || 'אחר'}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">שווי שוק:</span>
            <span className="font-semibold text-gray-900">{formatMarketCap(company.market_cap)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">עדכון אחרון:</span>
            <span className="text-gray-700 text-sm">{formatDate(company.last_updated)}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors">
            צפה בניתוח מלא ←
          </button>
        </div>
      </div>
    </div>
  );
}