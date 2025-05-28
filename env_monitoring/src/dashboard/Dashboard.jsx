/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Thermometer, Droplets, Wind, Volume2, Activity, AlertTriangle, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement);

// Firebase configuration
const FIREBASE_CONFIG = {
  databaseURL: "https://living-condition-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
  console.log('Firebase initialized successfully');
} else {
  firebase.app();
  console.log('Using existing Firebase app instance');
}

// Scoring weights and ranges
const SCORING_CONFIG = {
  temperature: {
    weight: 0.25,
    optimal: { min: 20, max: 26 },
    acceptable: { min: 18, max: 30 },
    unit: '°C'
  },
  humidity: {
    weight: 0.25,
    optimal: { min: 40, max: 60 },
    acceptable: { min: 30, max: 70 },
    unit: '%'
  },
  airQuality_ppm: {
    weight: 0.3,
    optimal: { min: 0, max: 400 },
    acceptable: { min: 0, max: 1000 },
    unit: 'PPM'
  },
  soundLevel: {
    weight: 0.2,
    optimal: { min: 0, max: 0.3 },
    acceptable: { min: 0, max: 0.7 },
    unit: 'Level'
  }
};

// Toast notification function
const showToast = (message, type = 'info') => {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 ${
    type === 'error' ? 'bg-red-500 text-white' : 
    type === 'success' ? 'bg-green-500 text-white' : 
    'bg-blue-500 text-white'
  }`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }
  }, 3000);
};

// Firebase service
class FirebaseService {
  subscribeToLatestReadings(callback) {
    const dataRef = firebase.database().ref('/latest_readings');
    console.log('Subscribing to Firebase path: /latest_readings');

    const listener = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('Received Firebase data:', data);
        callback(data);
      } else {
        console.warn("No data received from Firebase at /latest_readings. Check path and security rules.");
        callback(null);
      }
    };

    const errorCallback = (error) => {
      console.error("Firebase read error:", error);
      showToast(`Firebase error: ${error.message}. Check console, path, and security rules.`, 'error');
      callback(null);
    };

    dataRef.on('value', listener, errorCallback);

    return () => {
      console.log('Unsubscribing from Firebase path: /latest_readings');
      dataRef.off('value', listener);
    };
  }
}

// Scoring algorithm
const calculateScore = (sensorData) => {
  if (!sensorData) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  Object.entries(SCORING_CONFIG).forEach(([key, config]) => {
    const value = sensorData[key];
    if (value !== undefined && vina !== null && !isNaN(parseFloat(value))) {
      const numericValue = parseFloat(value);
      let score = 0;
      
      if (numericValue >= config.optimal.min && numericValue <= config.optimal.max) {
        score = 10;
      } else if (numericValue >= config.acceptable.min && numericValue <= config.acceptable.max) {
        const distanceFromOptimal = Math.min(
          Math.abs(numericValue - config.optimal.min),
          Math.abs(numericValue - config.optimal.max)
        );
        const maxDistance = Math.max(
          config.optimal.min - config.acceptable.min,
          config.acceptable.max - config.optimal.max
        );
        score = 5 + (maxDistance > 0 ? (5 * (1 - distanceFromOptimal / maxDistance)) : 5);
      } else {
        const distanceFromAcceptable = Math.min(
          Math.abs(numericValue - config.acceptable.min),
          Math.abs(numericValue - config.acceptable.max)
        );
        score = Math.max(0, 5 * Math.exp(-distanceFromAcceptable / (key === 'airQuality_ppm' ? 1000 : 100)));
      }

      totalScore += score * config.weight;
      totalWeight += config.weight;
    }
  });

  return totalWeight === 0 ? 0 : Math.round((totalScore / totalWeight) * 10) / 10;
};

// Gauge Chart Component
const GaugeChart = ({ score }) => {
  const getScoreColor = (score) => {
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#eab308';
    if (score >= 4) return '#f97316';
    return '#ef4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Poor';
  };

  const percentage = (score / 10) * 100;
  const color = getScoreColor(score);

  const data = {
    datasets: [{
      data: [percentage, 100 - percentage],
      backgroundColor: [color, '#e5e7eb'],
      borderWidth: 0,
      cutout: '75%',
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  };

  return (
    <div className="relative w-64 h-64 mx-auto">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-bold" style={{ color }}>
          {score.toFixed(1)}
        </div>
        <div className="text-sm text-gray-600">
          {getScoreLabel(score)}
        </div>
      </div>
    </div>
  );
};

// Sensor Card Component
const SensorCard = ({ icon: Icon, title, value, unit, status }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'excellent': return CheckCircle;
      case 'good': return AlertTriangle;
      case 'poor': return XCircle;
      default: return Activity;
    }
  };

  const StatusIcon = getStatusIcon(status);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Icon className="w-8 h-8 text-blue-500 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-2xl font-bold text-gray-900">
              {value !== null && value !== undefined ? `${value} ${unit}` : 'N/A'}
            </p>
          </div>
        </div>
        {status !== 'unknown' && <StatusIcon className={`w-6 h-6 ${getStatusColor(status)}`} />}
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = ({ onNavigateToAnalytics, sensorData, score }) => {
  const getSensorStatus = (key, value) => {
    if (value === null || value === undefined) return 'unknown';
    
    const config = SCORING_CONFIG[key];
    if (!config) return 'unknown';

    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return 'unknown';

    if (numericValue >= config.optimal.min && numericValue <= config.optimal.max) {
      return 'excellent';
    } else if (numericValue >= config.acceptable.min && numericValue <= config.acceptable.max) {
      return 'good';
    } else {
      return 'poor';
    }
  };

  if (!sensorData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sensor data from Firebase...</p>
          <p className="mt-2 text-sm text-gray-500">If this persists, check your internet connection, Firebase path, and security rules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Living Condition Monitor</h1>
        <p className="text-gray-600 mt-2">Real-time environmental monitoring dashboard</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Overall Living Condition Score</h2>
          <GaugeChart score={score} />
          <p className="text-gray-600 mt-4">
            Last updated: {
              sensorData.timestamp 
                ? (!isNaN(parseInt(sensorData.timestamp))
                    ? new Date(parseInt(sensorData.timestamp) * 1000).toLocaleString()
                    : String(sensorData.timestamp))
                : 'N/A'
            }
          </p>
          <button
            onClick={onNavigateToAnalytics}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2 mx-auto"
          >
            <BarChart3 className="w-5 h-5" />
            View Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SensorCard
          icon={Thermometer}
          title="Temperature"
          value={sensorData.temperature !== undefined && sensorData.temperature !== null ? parseFloat(sensorData.temperature).toFixed(1) : null}
          unit={SCORING_CONFIG.temperature.unit}
          status={getSensorStatus('temperature', sensorData.temperature)}
        />
        <SensorCard
          icon={Droplets}
          title="Humidity"
          value={sensorData.humidity !== undefined && sensorData.humidity !== null ? parseFloat(sensorData.humidity).toFixed(1) : null}
          unit={SCORING_CONFIG.humidity.unit}
          status={getSensorStatus('humidity', sensorData.humidity)}
        />
        <SensorCard
          icon={Wind}
          title="Air Quality"
          value={sensorData.airQuality_ppm !== undefined && sensorData.airQuality_ppm !== null ? parseFloat(sensorData.airQuality_ppm).toFixed(2) : null}
          unit={SCORING_CONFIG.airQuality_ppm.unit}
          status={getSensorStatus('airQuality_ppm', sensorData.airQuality_ppm)}
        />
        <SensorCard
          icon={Volume2}
          title="Sound Level"
          value={sensorData.soundLevel !== undefined && sensorData.soundLevel !== null ? parseFloat(sensorData.soundLevel).toFixed(3) : null}
          unit={SCORING_CONFIG.soundLevel.unit}
          status={getSensorStatus('soundLevel', sensorData.soundLevel)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Scoring Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(SCORING_CONFIG).map(([key, config]) => (
            <div key={key} className="border rounded p-4">
              <h4 className="font-semibold capitalize">{key.replace('_ppm', '').replace('_', ' ')}</h4>
              <p className="text-sm text-gray-600">
                Optimal: {config.optimal.min}-{config.optimal.max} {config.unit}
              </p>
              <p className="text-sm text-gray-600">
                Acceptable: {config.acceptable.min}-{config.acceptable.max} {config.unit}
              </p>
              <p className="text-sm text-gray-600">
                Weight: {(config.weight * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sensorData, setSensorData] = useState(null);
  const [score, setScore] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  
  const firebaseServiceRef = useRef(new FirebaseService());

  useEffect(() => {
    const currentFirebaseService = firebaseServiceRef.current;

    const handleDataUpdate = (data) => {
      if (data) {
        console.log('Setting sensor data:', data);
        setSensorData(data);
        const newScore = calculateScore(data);
        console.log('Calculated score:', newScore);
        setScore(newScore);
      } else {
        console.warn('No sensor data received, setting to null');
        setSensorData(null);
        setScore(0);
      }
    };

    const unsubscribe = currentFirebaseService.subscribeToLatestReadings(handleDataUpdate);

    return () => {
      console.log('Cleaning up Firebase subscription');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (sensorData === null) return;

    const now = Date.now();
    if (score < 4 && (now - lastNotificationTime > 60000)) {
      showToast('⚠️ Living conditions are poor! Check your environment.', 'error');
      setLastNotificationTime(now);
    } else if (score >= 8 && (now - lastNotificationTime > 300000)) {
      showToast('🌟 Excellent living conditions!', 'success');
      setLastNotificationTime(now);
    }
  }, [score, sensorData, lastNotificationTime]);

  const handleNavigateToAnalytics = () => {
    setCurrentPage('analytics');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  if (currentPage === 'analytics') {
    return (
      <AnalyticsDashboard 
        onBack={handleBackToDashboard}
        sensorData={sensorData}
        score={score}
      />
    );
  }

  return (
    <Dashboard 
      onNavigateToAnalytics={handleNavigateToAnalytics}
      sensorData={sensorData}
      score={score}
    />
  );
};

export default App;