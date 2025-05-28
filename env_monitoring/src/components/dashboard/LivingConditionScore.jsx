
import React from 'react';
import GaugeChart from '../ui/GaugeChart';

const LivingConditionScore = ({ score, lastUpdated, loading }) => {
  // Utility function to determine score color
  const getScoreColor = (score) => {
    if (score >= 7) return 'text-green-500 border-green-500';
    if (score >= 4) return 'text-yellow-500 border-yellow-500';
    return 'text-red-500 border-red-500';
  };

  // Utility function to determine score text
  const getScoreText = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 flex-1 flex flex-col items-center justify-center">
      <h2 className="text-lg font-medium text-gray-700 mb-4">Living Condition Score</h2>
      <GaugeChart 
        value={score}
        maxValue={10}
        loading={loading}
        lastUpdated={lastUpdated}
        getColor={getScoreColor}
        getText={getScoreText}
      />
    </div>
  );
};

export default LivingConditionScore;