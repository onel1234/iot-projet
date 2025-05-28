/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */ // Keep this if 'vina' is a global var, otherwise remove
import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Thermometer, Droplets, Wind, Volume2, Activity, AlertTriangle, CheckCircle, XCircle, BarChart3, TrendingUp, Info, WifiOff } from 'lucide-react'; // Added more icons
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import AnalyticsDashboard from '../components/AnalyticsDashboard'; // Assuming this path is correct

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
  firebase.app(); // If already initialized, use existing instance
  console.log('Using existing Firebase app instance');
}

// Scoring weights and ranges
const SCORING_CONFIG = {
  temperature: {
    weight: 0.25,
    optimal: { min: 20, max: 26 },
    acceptable: { min: 18, max: 30 },
    unit: '°C',
    icon: Thermometer,
    color: '#ef4444' // Red
  },
  humidity: {
    weight: 0.25,
    optimal: { min: 40, max: 60 },
    acceptable: { min: 30, max: 70 },
    unit: '%',
    icon: Droplets,
    color: '#3b82f6' // Blue
  },
  airQuality_ppm: {
    weight: 0.3,
    optimal: { min: 0, max: 400 },
    acceptable: { min: 0, max: 1000 },
    unit: 'PPM',
    icon: Wind,
    color: '#22c55e' // Green
  },
  soundLevel: {
    weight: 0.2,
    optimal: { min: 0, max: 0.3 }, // Assuming 0-1 scale or similar
    acceptable: { min: 0, max: 0.7 },
    unit: 'Level', // Unit can be dB or a relative scale
    icon: Volume2,
    color: '#f59e0b' // Amber
  }
};

// Toast notification function (enhanced slightly)
const showToast = (message, type = 'info', icon) => {
  const toast = document.createElement('div');
  let bgColor, textColor, borderColor, IconComponent;

  switch (type) {
    case 'error':
      bgColor = 'bg-red-500'; textColor = 'text-white'; borderColor = 'border-red-700'; IconComponent = icon || XCircle;
      break;
    case 'success':
      bgColor = 'bg-green-500'; textColor = 'text-white'; borderColor = 'border-green-700'; IconComponent = icon || CheckCircle;
      break;
    default:
      bgColor = 'bg-blue-500'; textColor = 'text-white'; borderColor = 'border-blue-700'; IconComponent = icon || Info;
      break;
  }

  toast.className = `fixed top-5 right-5 p-4 rounded-lg shadow-xl z-[100] flex items-center space-x-3 transition-all duration-500 ease-in-out transform translate-x-full opacity-0 ${bgColor} ${textColor} border-l-4 ${borderColor}`;
  
  // Create icon element if IconComponent is provided
  if (IconComponent) {
    const iconElement = document.createElement('span');
    // This is a hacky way to render Lucide icons. For a real app, use React Portals or a dedicated toast library.
    iconElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IconComponent().props.children.map(child => child.props.d ? `<path d="${child.props.d}"></path>`: '').join('')}</svg>`;
    toast.appendChild(iconElement);
  }
  
  const textElement = document.createElement('span');
  textElement.textContent = message;
  toast.appendChild(textElement);
  
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('translate-x-0', 'opacity-100');
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 500);
    }
  }, 3500);
};


// Firebase service
class FirebaseService {
  subscribeToLatestReadings(callback) {
    const dataRef = firebase.database().ref('/latest_readings');
    console.log('Subscribing to Firebase path: /latest_readings');

    const listener = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // console.log('Received Firebase data:', data);
        callback(data);
      } else {
        console.warn("No data received from Firebase at /latest_readings.");
        callback(null); // Explicitly pass null if no data
      }
    };

    const errorCallback = (error) => {
      console.error("Firebase read error:", error);
      showToast(`Firebase error: ${error.message}. Cannot fetch live data.`, 'error', WifiOff);
      callback(null); // Explicitly pass null on error
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
    // Corrected: remove 'vina' which was a typo and likely meant 'value'
    if (value !== undefined && value !== null && !isNaN(parseFloat(value))) {
      const numericValue = parseFloat(value);
      let score = 0;
      
      // Invert logic for airQuality_ppm and soundLevel where lower is better
      // For these, optimal.max is good, optimal.min is not necessarily the "best"
      // This example scoring is simplified; real-world might need non-linear functions
      if (key === 'airQuality_ppm' || key === 'soundLevel') {
        if (numericValue <= config.optimal.max) { // Lower is better, so check against max
          score = 10;
        } else if (numericValue <= config.acceptable.max) {
          score = 5 + 5 * (1 - (numericValue - config.optimal.max) / (config.acceptable.max - config.optimal.max));
        } else {
          // Exponential decay for values outside acceptable range
           score = Math.max(0, 5 * Math.exp(-(numericValue - config.acceptable.max) / (config.acceptable.max * 0.5))); // Decay faster
        }
      } else { // For temperature and humidity where a range is optimal
        if (numericValue >= config.optimal.min && numericValue <= config.optimal.max) {
          score = 10;
        } else if (numericValue >= config.acceptable.min && numericValue <= config.acceptable.max) {
          const rangeWidth = config.optimal.min - config.acceptable.min; // Assuming symmetric acceptable range
          const dist = numericValue < config.optimal.min ? config.optimal.min - numericValue : numericValue - config.optimal.max;
          score = 5 + 5 * (1 - dist / rangeWidth);
        } else {
           const dist = numericValue < config.acceptable.min ? config.acceptable.min - numericValue : numericValue - config.acceptable.max;
           score = Math.max(0, 5 * Math.exp(-dist / ((config.acceptable.max - config.acceptable.min) * 0.2))); // Decay faster
        }
      }
      score = Math.max(0, Math.min(10, score)); // Clamp score between 0 and 10
      totalScore += score * config.weight;
      totalWeight += config.weight;
    }
  });
  if (totalWeight === 0) return 0;
  const finalScore = (totalScore / totalWeight);
  return Math.round(finalScore * 10) / 10; // Score out of 10, one decimal place
};

// Gauge Chart Component (Enhanced UI)
const GaugeChart = ({ score }) => {
  const getScoreAttributes = (score) => {
    if (score >= 8) return { color: '#22c55e', label: 'Excellent', bgColor: 'bg-green-50' };
    if (score >= 6) return { color: '#f59e0b', label: 'Good', bgColor: 'bg-amber-50' }; // Changed to amber
    if (score >= 4) return { color: '#f97316', label: 'Fair', bgColor: 'bg-orange-50' };
    return { color: '#ef4444', label: 'Poor', bgColor: 'bg-red-50' };
  };

  const { color, label, bgColor } = getScoreAttributes(score);
  const percentage = (score / 10) * 100;

  const data = {
    datasets: [{
      data: [percentage, 100 - percentage],
      backgroundColor: [color, '#e5e7eb'], // Use a lighter gray for the remainder
      borderWidth: 0,
      cutout: '80%', // Thinner ring
      borderRadius: 20, // Rounded ends for the arc
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
    },
  };

  return (
    <div className={`relative w-56 h-56 md:w-64 md:h-64 mx-auto p-2 rounded-full ${bgColor}`}>
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-5xl md:text-6xl font-bold" style={{ color }}>
          {score.toFixed(1)}
        </div>
        <div className="text-sm md:text-base font-medium text-slate-700 mt-1" style={{ color }}>
          {label}
        </div>
      </div>
    </div>
  );
};


// Sensor Card Component (Enhanced UI)
const SensorCard = ({ icon: Icon, title, value, unit, status, color }) => {
  const getStatusAttributes = (status) => {
    switch (status) {
      case 'excellent': return { SIcon: CheckCircle, sColor: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-500' };
      case 'good': return { SIcon: AlertTriangle, sColor: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-500' };
      case 'poor': return { SIcon: XCircle, sColor: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-500' };
      default: return { SIcon: Activity, sColor: 'text-slate-500', bgColor: 'bg-slate-50', borderColor: 'border-slate-400' };
    }
  };

  const { SIcon, sColor, bgColor, borderColor } = getStatusAttributes(status);
  const displayValue = (value !== null && value !== undefined && !isNaN(parseFloat(value))) ? `${parseFloat(value).toFixed(title === "Sound Level" ? 3 : 1)} ${unit}` : 'N/A';

  return (
    <div className={`rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-out transform hover:-translate-y-1 ${bgColor} border-l-4 ${borderColor} overflow-hidden`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}> {/* Icon background with opacity */}
            <Icon className="w-7 h-7" style={{ color: color }} />
          </div>
          <SIcon className={`w-6 h-6 mt-1 ${sColor}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
          <p className="text-3xl font-bold text-slate-800" style={{ color: color }}>
            {displayValue}
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component (Enhanced UI)
const Dashboard = ({ onNavigateToAnalytics, sensorData, score }) => {
  const getSensorStatus = (key, value) => {
    if (value === null || value === undefined || value === 'N/A') return 'unknown';
    const config = SCORING_CONFIG[key];
    if (!config) return 'unknown';
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return 'unknown';

    if (key === 'airQuality_ppm' || key === 'soundLevel') { // Lower is better
        if (numericValue <= config.optimal.max) return 'excellent';
        if (numericValue <= config.acceptable.max) return 'good';
        return 'poor';
    } else { // Range is optimal
        if (numericValue >= config.optimal.min && numericValue <= config.optimal.max) return 'excellent';
        if (numericValue >= config.acceptable.min && numericValue <= config.acceptable.max) return 'good';
        return 'poor';
    }
  };

  if (!sensorData) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin rounded-full h-20 w-20 md:h-24 md:w-24 border-t-4 border-b-4 border-blue-500 mb-6"></div>
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-700 mb-2">Connecting to Live Data...</h2>
        <p className="text-slate-500 md:text-lg">
          Attempting to fetch real-time environmental readings.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          If this persists, please check your internet connection and Firebase setup.
        </p>
      </div>
    );
  }
  
  const lastUpdatedTimestamp = sensorData.timestamp;
  let lastUpdatedString = 'N/A';
  if (lastUpdatedTimestamp) {
    const tsNumber = parseInt(lastUpdatedTimestamp);
    if (!isNaN(tsNumber)) {
        // Assuming timestamp might be in seconds or milliseconds
        const dateObj = new Date(tsNumber * (String(tsNumber).length === 10 ? 1000 : 1));
        lastUpdatedString = dateObj.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
        lastUpdatedString = String(lastUpdatedTimestamp); // Fallback if not a number
    }
  }


  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <header className="text-center mb-10 md:mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight">Living Condition Monitor</h1>
        <p className="text-slate-600 mt-3 text-lg md:text-xl">Your real-time environmental dashboard.</p>
      </header>

      <div className="bg-white rounded-xl shadow-xl p-6 md:p-10 mb-10 md:mb-12">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-700 mb-6 md:mb-8">Overall Living Condition Score</h2>
          <GaugeChart score={score} />
          <p className="text-slate-500 mt-6 md:mt-8 text-sm">
            Last updated: {lastUpdatedString}
          </p>
          <button
            onClick={onNavigateToAnalytics}
            className="mt-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center gap-2 mx-auto text-base md:text-lg"
          >
            <TrendingUp className="w-5 h-5" />
            View Detailed Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 md:mb-12">
        {Object.entries(SCORING_CONFIG).map(([key, config]) => (
          <SensorCard
            key={key}
            icon={config.icon}
            title={key.replace('_ppm', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
            value={sensorData[key]}
            unit={config.unit}
            status={getSensorStatus(key, sensorData[key])}
            color={config.color}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-xl p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-slate-700 mb-6 text-center md:text-left">Scoring Criteria Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Object.entries(SCORING_CONFIG).map(([key, config]) => (
            <div key={key} className="border border-slate-200 rounded-lg p-5 bg-slate-50 hover:bg-white transition-colors">
              <div className="flex items-center mb-3">
                <config.icon className="w-6 h-6 mr-3" style={{color: config.color}} />
                <h4 className="text-lg font-medium text-slate-800 capitalize">{key.replace('_ppm', ' (PPM)').replace(/([A-Z])/g, ' $1').trim()}</h4>
              </div>
              <div className="text-sm space-y-1 text-slate-600">
                <p><strong>Optimal:</strong> {config.optimal.min} - {config.optimal.max} {config.unit}</p>
                <p><strong>Acceptable:</strong> {config.acceptable.min} - {config.acceptable.max} {config.unit}</p>
                <p><strong>Weight:</strong> <span className="font-semibold" style={{color: config.color}}>{(config.weight * 100).toFixed(0)}%</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="text-center mt-12 py-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Living Condition Monitoring. Stay Informed.</p>
      </footer>
    </div>
  );
};

// Main App Component
const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sensorData, setSensorData] = useState(null); // Initialize with null for loading state
  const [score, setScore] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  const notificationCooldown = 60000; // 1 minute cooldown for poor, 5 for excellent
  
  const firebaseServiceRef = useRef(null);

  useEffect(() => {
    // Ensure FirebaseService is initialized only once
    if (!firebaseServiceRef.current) {
        firebaseServiceRef.current = new FirebaseService();
    }
    const currentFirebaseService = firebaseServiceRef.current;

    const handleDataUpdate = (data) => {
      if (data) {
        // console.log('Setting sensor data:', data);
        setSensorData(data);
        const newScore = calculateScore(data);
        // console.log('Calculated score:', newScore);
        setScore(newScore);
      } else {
        // console.warn('No sensor data received, maintaining previous or setting to null');
        // Keep existing data if new data is null to prevent UI flickering during brief disconnects
        // Only set to null if it was null initially, or explicitly on error.
        // For now, if null comes, we show loading.
        if (sensorData !== null) { // if we had data before and now it's null, maybe an issue
            console.warn("Received null data after having valid data. Potential connection issue.");
            // Optionally, you could setSensorData(null) here to show loading state again
            // or keep stale data for a bit with a "connection lost" indicator.
            // For simplicity, we'll let it reflect the null.
        }
         setSensorData(null);
         setScore(0);
      }
    };

    const unsubscribe = currentFirebaseService.subscribeToLatestReadings(handleDataUpdate);

    return () => {
      // console.log('Cleaning up Firebase subscription in App component');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  useEffect(() => {
    if (sensorData === null) return; // Don't run notifications if no data

    const now = Date.now();
    if (score < 4 && (now - lastNotificationTime > notificationCooldown)) { // Poor conditions
      showToast('⚠️ Living conditions are poor! Check your environment.', 'error', AlertTriangle);
      setLastNotificationTime(now);
    } else if (score >= 8 && (now - lastNotificationTime > notificationCooldown * 5)) { // Excellent conditions (longer cooldown)
      showToast('🌟 Excellent living conditions! Well done.', 'success', CheckCircle);
      setLastNotificationTime(now);
    }
  }, [score, sensorData, lastNotificationTime]);

  const handleNavigateToAnalytics = () => setCurrentPage('analytics');
  const handleBackToDashboard = () => setCurrentPage('dashboard');

  if (currentPage === 'analytics') {
    return (
      <AnalyticsDashboard 
        onBack={handleBackToDashboard}
        // sensorData and score are not directly passed to AnalyticsDashboard in your current setup
        // It fetches its own historical data. If needed, you can pass latest sensorData/score
      />
    );
  }

  // Pass sensorData and score to Dashboard
  return (
    <Dashboard 
      onNavigateToAnalytics={handleNavigateToAnalytics}
      sensorData={sensorData}
      score={score}
    />
  );
};

export default App;