/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Thermometer, Droplets, Wind, Volume2, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const AnalyticsDashboard = ({ onBack, sensorData, score }) => {
  // Generate sample historical data for demonstration
  const generateSampleData = () => {
    const now = new Date();
    const data = [];
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now - i * 60 * 60 * 1000);
      data.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: time.getTime(),
        temperature: 20 + Math.random() * 8 + Math.sin(i / 4) * 3,
        humidity: 45 + Math.random() * 20 + Math.cos(i / 3) * 10,
        airQuality_ppm: 300 + Math.random() * 400 + Math.sin(i / 6) * 200,
        soundLevel: 0.1 + Math.random() * 0.5 + Math.sin(i / 8) * 0.2,
        score: 4 + Math.random() * 4 + Math.sin(i / 5) * 2
      });
    }
    
    return data;
  };

  const [historicalData] = useState(generateSampleData());

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Value'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const createChartData = (dataKey, label, color) => ({
    labels: historicalData.map(d => d.time),
    datasets: [{
      label: label,
      data: historicalData.map(d => d[dataKey]),
      borderColor: color,
      backgroundColor: color + '20',
      borderWidth: 2,
      fill: false,
      tension: 0.1
    }]
  });

  const calculateTrend = (dataKey) => {
    const recent = historicalData.slice(-6).map(d => d[dataKey]);
    const older = historicalData.slice(-12, -6).map(d => d[dataKey]);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return recentAvg - olderAvg;
  };

  const StatCard = ({ title, value, unit, trend, icon: Icon }) => {
    const isPositive = trend > 0;
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Icon className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-gray-500">{title}</h3>
              <p className="text-2xl font-bold text-gray-900">
                {value !== null && value !== undefined ? `${value} ${unit}` : 'N/A'}
              </p>
            </div>
          </div>
          <div className={`flex items-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            <TrendIcon className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">
              {Math.abs(trend).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-8">
        <button
          onClick={onBack}
          className="mb-4 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">Historical data and trends analysis</p>
      </div>

      {/* Current Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Temperature Trend"
          value={sensorData?.temperature ? parseFloat(sensorData.temperature).toFixed(1) : null}
          unit="°C"
          trend={calculateTrend('temperature')}
          icon={Thermometer}
        />
        <StatCard
          title="Humidity Trend"
          value={sensorData?.humidity ? parseFloat(sensorData.humidity).toFixed(1) : null}
          unit="%"
          trend={calculateTrend('humidity')}
          icon={Droplets}
        />
        <StatCard
          title="Air Quality Trend"
          value={sensorData?.airQuality_ppm ? parseFloat(sensorData.airQuality_ppm).toFixed(0) : null}
          unit="PPM"
          trend={calculateTrend('airQuality_ppm')}
          icon={Wind}
        />
        <StatCard
          title="Sound Level Trend"
          value={sensorData?.soundLevel ? parseFloat(sensorData.soundLevel).toFixed(2) : null}
          unit="Level"
          trend={calculateTrend('soundLevel')}
          icon={Volume2}
        />
      </div>

      {/* Historical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Temperature (24h)</h3>
          <div className="h-64">
            <Line 
              data={createChartData('temperature', 'Temperature (°C)', '#ef4444')} 
              options={lineChartOptions} 
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Humidity (24h)</h3>
          <div className="h-64">
            <Line 
              data={createChartData('humidity', 'Humidity (%)', '#3b82f6')} 
              options={lineChartOptions} 
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Air Quality (24h)</h3>
          <div className="h-64">
            <Line 
              data={createChartData('airQuality_ppm', 'Air Quality (PPM)', '#10b981')} 
              options={lineChartOptions} 
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Sound Level (24h)</h3>
          <div className="h-64">
            <Line 
              data={createChartData('soundLevel', 'Sound Level', '#f59e0b')} 
              options={lineChartOptions} 
            />
          </div>
        </div>
      </div>

      {/* Overall Score Trend */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Overall Score Trend (24h)</h3>
        <div className="h-64">
          <Line 
            data={createChartData('score', 'Living Condition Score', '#8b5cf6')} 
            options={lineChartOptions} 
          />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;