import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Thermometer, Droplets, Wind, Volume2, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

// Import Firebase compat libraries for v8 API style
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

ChartJS.register(ArcElement, Tooltip, Legend);

// Firebase configuration - provided by you
const FIREBASE_CONFIG = {
  databaseURL: "https://living-condition-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase (ensure it's done only once)
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
} else {
  firebase.app(); // if already initialized, use that one
}

// Scoring weights and ranges (remains unchanged)
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
    optimal: { min: 0, max: 400 }, // Assuming PPM, 0-400 is very good
    acceptable: { min: 0, max: 1000 }, // WHO good AQI is <50, moderate 50-100. For PPM, 1000 is often CO2 threshold.
    unit: 'PPM'
  },
  soundLevel: {
    weight: 0.2,
    optimal: { min: 0, max: 0.3 }, // Assuming normalized or specific sensor scale
    acceptable: { min: 0, max: 0.7 },
    unit: 'Level'
  }
};

// Toast notification function (remains unchanged)
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
    if (toast.parentNode) { // Check if toast is still in DOM
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }
  }, 3000);
};

// Firebase service - REAL IMPLEMENTATION
class FirebaseService {
  subscribeToLatestReadings(callback) {
    // !!! IMPORTANT: Replace '/latestReadings' with the actual path to your sensor data in Firebase Realtime Database.
    // For example:
    // - If your data is at the root: firebase.database().ref()
    // - If under a node 'sensor_data': firebase.database().ref('/sensor_data')
    // - If under a device ID, e.g., 'device123/readings': firebase.database().ref('/device123/readings')
    const dataRef = firebase.database().ref('/latest_readings'); // <<< --- VERIFY AND CHANGE THIS PATH

    const listener = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data);
      } else {
        // This can happen if the path is wrong, no data exists, or due to permissions.
        console.warn("No data received from Firebase at the specified path. Check path and Firebase security rules.");
        callback(null); // Signal that data is not available
      }
    };

    const errorCallback = (error) => {
      console.error("Firebase read error:", error);
      showToast(`Firebase error: ${error.message}. Check console, Firebase path, and security rules.`, 'error');
      callback(null); // Signal error/no data
    };

    // Attach the listener
    dataRef.on('value', listener, errorCallback);

    // Return an unsubscribe function to be called on cleanup
    return () => {
      dataRef.off('value', listener); // Detach the same listener instance
    };
  }
}

// Scoring algorithm (remains unchanged)
const calculateScore = (sensorData) => {
  if (!sensorData) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  Object.entries(SCORING_CONFIG).forEach(([key, config]) => {
    const value = sensorData[key];
    if (value !== undefined && value !== null && !isNaN(parseFloat(value))) { // Ensure value is a usable number
      const numericValue = parseFloat(value);
      let score = 0;
      
      if (numericValue >= config.optimal.min && numericValue <= config.optimal.max) {
        score = 10;
      }
      else if (numericValue >= config.acceptable.min && numericValue <= config.acceptable.max) {
        const distanceFromOptimal = Math.min(
          Math.abs(numericValue - config.optimal.min),
          Math.abs(numericValue - config.optimal.max)
        );
        const maxDistance = Math.max(
          config.optimal.min - config.acceptable.min,
          config.acceptable.max - config.optimal.max
        );
        // Handle maxDistance being 0 to avoid division by zero if optimal and acceptable bounds are the same
        score = 5 + (maxDistance > 0 ? (5 * (1 - distanceFromOptimal / maxDistance)) : 5); 
      }
      else {
        const distanceFromAcceptable = Math.min(
          Math.abs(numericValue - config.acceptable.min),
          Math.abs(numericValue - config.acceptable.max)
        );
        score = Math.max(0, 5 * Math.exp(-distanceFromAcceptable / (key === 'airQuality_ppm' ? 1000 : 100))); // Adjusted decay for AQ
      }

      totalScore += score * config.weight;
      totalWeight += config.weight;
    }
  });

  return totalWeight === 0 ? 0 : Math.round((totalScore / totalWeight) * 10) / 10;
};


// Gauge Chart Component (remains unchanged)
const GaugeChart = ({ score }) => {
  const getScoreColor = (score) => {
    if (score >= 8) return '#22c55e'; // Green
    if (score >= 6) return '#eab308'; // Yellow
    if (score >= 4) return '#f97316'; // Orange
    return '#ef4444'; // Red
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
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    }
  };

  return (
    <div className="relative w-64 h-64">
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

// Sensor Card Component (remains unchanged)
const SensorCard = ({ icon: Icon, title, value, unit, status }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500'; // Changed from yellow to orange for 'good' to match AlertTriangle better
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'excellent': return CheckCircle;
      case 'good': return AlertTriangle; // AlertTriangle often implies caution/warning
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
const Dashboard = () => {
  const [sensorData, setSensorData] = useState(null);
  const [score, setScore] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  
  // useRef to hold the FirebaseService instance. Initialize it once.
  const firebaseServiceRef = useRef(new FirebaseService());

  // Effect for Firebase subscription
  useEffect(() => {
    const currentFirebaseService = firebaseServiceRef.current;

    const handleDataUpdate = (data) => {
      if (data) {
        setSensorData(data);
        const newScore = calculateScore(data); 
        setScore(newScore);
      } else {
        // Data is null (e.g., path error, no data, or permission issue)
        // This will make the UI show the loading spinner again.
        setSensorData(null); 
        setScore(0); // Reset score
      }
    };

    const unsubscribe = currentFirebaseService.subscribeToLatestReadings(handleDataUpdate);

    // Cleanup function for when the component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe(); // Detach the Firebase listener
      }
    };
  }, []); // Empty dependency array: effect runs once on mount and cleans up on unmount.

  // Effect for handling notifications based on score changes
  useEffect(() => {
    // Don't run if data isn't loaded yet or was cleared due to an error
    if (sensorData === null) return; 

    const now = Date.now();
    // Check score and time since last notification
    if (score < 4 && (now - lastNotificationTime > 60000)) { // Poor score, notify max once per 60s
      showToast('⚠️ Living conditions are poor! Check your environment.', 'error');
      setLastNotificationTime(now);
    } else if (score >= 8 && (now - lastNotificationTime > 300000)) { // Excellent score, notify max once per 5 mins
      showToast('🌟 Excellent living conditions!', 'success');
      setLastNotificationTime(now);
    }
  }, [score, sensorData, lastNotificationTime]); // Dependencies for re-running notification logic

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
          <p className="mt-2 text-sm text-gray-500">If this persists, check your internet connection, Firebase path in the code, and Firebase security rules. Open the browser console for error details.</p>
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
              ? (
                  !isNaN(parseInt(sensorData.timestamp)) // Check if timestamp is a number-like string
                  ? new Date(parseInt(sensorData.timestamp) * 1000).toLocaleString() // Assumes Unix timestamp in seconds
                  : String(sensorData.timestamp) // If not parsable as int, display as is
                )
              : 'N/A'
            }
          </p>
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

export default Dashboard;