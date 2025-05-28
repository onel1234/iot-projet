import React from 'react';
import { RefreshCw } from 'lucide-react';

const GaugeChart = ({
  value,
  maxValue = 10,
  loading = false,
  lastUpdated,
  getColor,
  getText
}) => {
  const safeValue = typeof value === 'number' ? value : 0;
  const percentage = (safeValue / maxValue) * 100;
  const rotation = 45 + (safeValue / maxValue) * 270;

  // Default color function if not provided
  const defaultGetColor = (val) => {
    const normalizedValue = val / maxValue;
    if (normalizedValue >= 0.7) return 'text-green-500 border-green-500';
    if (normalizedValue >= 0.4) return 'text-yellow-500 border-yellow-500';
    return 'text-red-500 border-red-500';
  };

  // Default text function if not provided
  const defaultGetText = (val) => {
    const normalizedValue = val / maxValue;
    if (normalizedValue >= 0.8) return 'Excellent';
    if (normalizedValue >= 0.6) return 'Good';
    if (normalizedValue >= 0.4) return 'Fair';
    return 'Poor';
  };

  // Use provided functions or fallback to defaults
  const colorClass = getColor ? getColor(safeValue) : defaultGetColor(safeValue);
  const statusText = getText ? getText(safeValue) : defaultGetText(safeValue);
  const textColorClass = colorClass.split(' ')[0];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-40 w-40">
        {/* Background circle */}
        <div className="absolute inset-0 rounded-full border-8 border-gray-200"></div>

        {/* Colored arc */}
        <div
          className={`absolute inset-0 rounded-full border-8 border-t-transparent border-r-transparent ${colorClass.split(' ')[1] || 'border-blue-500'}`}
          style={{ transform: `rotate(${rotation}deg)` }}
        ></div>

        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className={`text-4xl font-bold ${textColorClass}`}>
            {typeof value === 'number' ? safeValue.toFixed(1) : 'N/A'}
          </span>
          <span className="text-sm font-medium text-gray-500">{statusText}</span>
        </div>
      </div>

      {/* Last updated indicator */}
      {lastUpdated && (
        <div className="mt-4 text-xs text-gray-500 flex items-center">
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          <span>Last updated: {new Date(lastUpdated).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
};

export default GaugeChart;
