/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Area, AreaChart, PieChart, Pie, Cell, ComposedChart,
  ScatterChart, Scatter, RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  Calendar, Clock, TrendingUp, TrendingDown, Activity, AlertTriangle, 
  BarChart3, ArrowLeft, Filter, Download,
  Thermometer, Droplets, Wind, Volume2, Award, TrendingUpIcon, BarChartBig, ActivityIcon, Maximize // Added icons
} from 'lucide-react'; // Added more icons
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

// Initialize Firebase if not already done
const FIREBASE_CONFIG = {
  databaseURL: "https://living-condition-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app"
};

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// Color scheme for consistent styling
const COLORS = {
  temperature: '#ef4444', // Red
  humidity: '#3b82f6',    // Blue
  airQuality_ppm: '#22c55e', // Green
  soundLevel: '#f59e0b', // Amber
  score: '#8b5cf6',      // Violet
  default: '#6b7280'    // Gray for fallback
};

const METRIC_ICONS = {
  temperature: Thermometer,
  humidity: Droplets,
  airQuality_ppm: Wind,
  soundLevel: Volume2,
  score: Award,
};

const AnalyticsDashboard = ({ onBack }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('all'); 
  const [historicalData, setHistoricalData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trends');

  // --- Data Fetching useEffect (remains the same as your previous version) ---
  useEffect(() => {
    const fetchHistoricalData = async (startTime) => {
      console.log("Fetching historical data starting from timestamp:", startTime);
      const dataRef = firebase.database().ref('environmental_data');
      try {
        const snapshot = await dataRef.orderByChild('timestamp').startAt(startTime).once('value');
        
        if (!snapshot.exists()) {
          console.warn("Snapshot does not exist for 'environmental_data' with startAt:", startTime);
          return [];
        }

        const rawData = snapshot.val();
        if (!rawData || typeof rawData !== 'object') {
            console.warn("Raw data from Firebase for 'environmental_data' is not a valid object or is null:", rawData);
            return [];
        }
        // console.log("Raw historical data received (first 500 chars):", JSON.stringify(rawData, null, 2).substring(0, 500) + "...");

        const processedData = Object.keys(rawData).map(key => {
          const record = rawData[key];
          if (!record || typeof record !== 'object') {
            console.warn(`Skipping invalid historical record for key ${key}:`, record);
            return null;
          }
          let timestampNum = record.timestamp;
          if (typeof timestampNum === 'string') {
            const parsed = parseInt(timestampNum, 10);
            if (!isNaN(parsed)) timestampNum = parsed;
          }
          if (typeof timestampNum !== 'number' || isNaN(timestampNum)) {
            console.warn(`Skipping historical record with invalid or missing timestamp (key: ${key}). Record:`, record);
            return null;
          }
          const dateObj = new Date(timestampNum);
          if (isNaN(dateObj.getTime())) {
            console.warn(`Skipping historical record with timestamp that results in invalid Date object (key: ${key}, timestamp: ${timestampNum}). Record:`, record);
            return null;
          }
          return {
            ...record, 
            timestamp: timestampNum,
            date: dateObj.toISOString().split('T')[0],
            hour: dateObj.getHours(),
            time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            temperature: record.temperature !== undefined && !isNaN(parseFloat(record.temperature)) ? Number(record.temperature) : undefined,
            humidity: record.humidity !== undefined && !isNaN(parseFloat(record.humidity)) ? Number(record.humidity) : undefined,
            airQuality_ppm: record.airQuality_ppm !== undefined && !isNaN(parseFloat(record.airQuality_ppm)) ? Number(record.airQuality_ppm) : undefined,
            soundLevel: record.soundLevel !== undefined && !isNaN(parseFloat(record.soundLevel)) ? Number(record.soundLevel) : undefined,
            score: record.score !== undefined && !isNaN(parseFloat(record.score)) ? Number(record.score) : undefined,
          };
        }).filter(item => item !== null);

        if (processedData.length === 0 && Object.keys(rawData).length > 0) {
            console.warn("All historical records were filtered out during processing.");
        } else if (processedData.length === 0) {
             console.warn("No processable historical data found after fetching.");
        }
        processedData.sort((a, b) => a.timestamp - b.timestamp);
        // console.log(`Processed ${processedData.length} historical records.`);
        return processedData;
      } catch (err) {
        console.error("Firebase Error in fetchHistoricalData:", err);
        let detailedErrorMessage = "Failed to load historical trend data. Check console for details.";
        if (err.message) detailedErrorMessage += ` Firebase reported: ${err.message}`;
        setError(detailedErrorMessage);
        return [];
      }
    };
    const fetchHourlyData = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const path = `aggregated_data/hourly/${year}/${month}/${day}`;
      // console.log("Fetching hourly aggregated data from path:", path);
      const hourlyAggRef = firebase.database().ref(path);
      try {
        const snapshot = await hourlyAggRef.once('value');
        if (!snapshot.exists()) {
          console.warn(`Snapshot does not exist for hourly aggregated data at path: ${path}.`);
          return [];
        }
        const rawData = snapshot.val();
        if (!rawData || typeof rawData !== 'object') {
            console.warn("Raw hourly data from Firebase is not a valid object or is null:", rawData);
            return [];
        }
        // console.log("Raw hourly data received (first 500 chars):", JSON.stringify(rawData, null, 2).substring(0, 500) + "...");
        const processedData = Object.keys(rawData).map(hourKey => {
          const hourRecord = rawData[hourKey];
          if (!hourRecord || typeof hourRecord !== 'object') {
              console.warn(`Skipping invalid hourly record for key ${hourKey}:`, hourRecord);
              return null;
          }
          return {
            hour: `${hourKey.padStart(2, '0')}:00`,
            avgTemperature: hourRecord.avgTemperature !== undefined && !isNaN(parseFloat(hourRecord.avgTemperature)) ? Number(hourRecord.avgTemperature) : undefined,
            avgHumidity: hourRecord.avgHumidity !== undefined && !isNaN(parseFloat(hourRecord.avgHumidity)) ? Number(hourRecord.avgHumidity) : undefined,
            avgAirQuality: (hourRecord.avgAirQuality_ppm !== undefined && !isNaN(parseFloat(hourRecord.avgAirQuality_ppm))) ? Number(hourRecord.avgAirQuality_ppm) : 
                           (hourRecord.avgAirQuality !== undefined && !isNaN(parseFloat(hourRecord.avgAirQuality))) ? Number(hourRecord.avgAirQuality) : undefined,
            avgSoundLevel: hourRecord.avgSoundLevel !== undefined && !isNaN(parseFloat(hourRecord.avgSoundLevel)) ? Number(hourRecord.avgSoundLevel) : undefined,
            avgScore: hourRecord.avgScore !== undefined && !isNaN(parseFloat(hourRecord.avgScore)) ? Number(hourRecord.avgScore) : undefined,
            readings: hourRecord.readings !== undefined && !isNaN(parseInt(hourRecord.readings)) ? Number(hourRecord.readings) : 0
          };
        }).filter(item => item !== null);

        if (processedData.length === 0 && Object.keys(rawData).length > 0) {
            console.warn("All hourly records were filtered out during processing.");
        } else if (processedData.length === 0) {
            console.warn("No processable hourly data found after fetching.");
        }
        processedData.sort((a, b) => a.hour.localeCompare(b.hour));
        // console.log(`Processed ${processedData.length} hourly aggregated records.`);
        return processedData;
      } catch (err) {
        console.error("Firebase Error in fetchHourlyData:", err);
        let detailedErrorMessage = `Failed to load hourly pattern data from path '${path}'.`;
         if (err.message) detailedErrorMessage += ` Firebase reported: ${err.message}`;
        if (!error) setError(detailedErrorMessage);
        else console.warn("Hourly data fetch also failed, but an error related to historical data is already displayed:", detailedErrorMessage);
        return [];
      }
    };
    const loadData = async () => {
      setLoading(true);
      setError(null);
      const currentTimestamp = Date.now();
      let startTime;
      switch (timeRange) {
        case '24h': startTime = currentTimestamp - (24 * 60 * 60 * 1000); break;
        case '7d': startTime = currentTimestamp - (7 * 24 * 60 * 60 * 1000); break;
        case '30d': startTime = currentTimestamp - (30 * 24 * 60 * 60 * 1000); break;
        default: startTime = currentTimestamp - (7 * 24 * 60 * 60 * 1000);
      }
      const histData = await fetchHistoricalData(startTime);
      const hrlyData = await fetchHourlyData(); 
      setHistoricalData(histData);
      setHourlyData(hrlyData);
      setLoading(false);
    };
    loadData();
  }, [timeRange]); // Note: 'error' was removed from dependency array as it's for display and could cause loops if fetch fails repeatedly.

  // --- Statistics and Chart Utility Functions (remain the same) ---
  const getStatistics = () => {
    if (!historicalData.length) return {};
    const stats = {};
    const metrics = ['temperature', 'humidity', 'airQuality_ppm', 'soundLevel', 'score'];
    metrics.forEach(metric => {
      const values = historicalData.map(d => d[metric]).filter(v => v != null && !isNaN(v));
      if (values.length > 0) {
        stats[metric] = {
          avg: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)),
          min: Math.min(...values),
          max: Math.max(...values),
          latest: values[values.length - 1]
        };
      } else {
         stats[metric] = { avg: 'N/A', min: 'N/A', max: 'N/A', latest: 'N/A' };
      }
    });
    return stats;
  };
  const statistics = getStatistics();

  const formatXAxisTick = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (timeRange === '24h') return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const formatTooltipLabel = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // --- Chart Components (minor UI tweaks if needed, but mostly functional) ---
  // TrendChart, ScoreChart, HourlyPatternChart, DistributionChart, CorrelationChart, RadarChartComponent
  // These components will benefit from the overall page styling and consistent chart wrappers.
  // For brevity, their internal structure remains largely the same as your previous version,
  // but they will now be wrapped in the new styled chart containers.

  const ChartWrapper = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-slate-700">{title}</h3>
        {/* <button className="text-slate-400 hover:text-slate-600">
            <Maximize size={18} />
        </button> */}
      </div>
      {children}
    </div>
  );

  const TrendChart = () => (
    <ChartWrapper title="Environmental Trends">
      {historicalData.length > 0 ? (
        <div className="h-80"> {/* Ensure fixed height for responsive container */}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="timestamp" tickFormatter={formatXAxisTick} tick={{ fontSize: 11, fill: '#666' }} domain={['dataMin', 'dataMax']} type="number" />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#666' }} domain={['auto', 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#666' }} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={formatTooltipLabel} formatter={(value, name) => [value, name.replace('_ppm', ' (PPM)')]} />
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              {historicalData.some(d => d.temperature !== undefined) && <Line yAxisId="left" type="monotone" dataKey="temperature" stroke={COLORS.temperature} strokeWidth={2} name="Temperature (°C)" dot={false} connectNulls={true} />}
              {historicalData.some(d => d.humidity !== undefined) && <Line yAxisId="left" type="monotone" dataKey="humidity" stroke={COLORS.humidity} strokeWidth={2} name="Humidity (%)" dot={false} connectNulls={true} />}
              {historicalData.some(d => d.airQuality_ppm !== undefined) && <Line yAxisId="right" type="monotone" dataKey="airQuality_ppm" stroke={COLORS.airQuality_ppm} strokeWidth={2} name="Air Quality (PPM)" dot={false} connectNulls={true} />}
              {historicalData.some(d => d.soundLevel !== undefined) && <Line yAxisId="left" type="monotone" dataKey="soundLevel" stroke={COLORS.soundLevel} strokeWidth={2} name="Sound Level" dot={false} connectNulls={true} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-slate-500 text-center py-10">No trend data available. Check console for details.</p>
      )}
    </ChartWrapper>
  );

  const ScoreChart = () => (
    <ChartWrapper title="Living Condition Score Trend">
      {historicalData.length > 0 && historicalData.some(d => d.score !== undefined) ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData.filter(d => d.score !== undefined)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="timestamp" tickFormatter={formatXAxisTick} tick={{ fontSize: 11, fill: '#666' }} domain={['dataMin', 'dataMax']} type="number" />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip labelFormatter={formatTooltipLabel} />
              <Area type="monotone" dataKey="score" stroke={COLORS.score} fill={COLORS.score} fillOpacity={0.3} strokeWidth={2} dot={false} connectNulls={true} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-slate-500 text-center py-10">No score data available for trend.</p>
      )}
    </ChartWrapper>
  );

  const HourlyPatternChart = () => (
    <ChartWrapper title="Hourly Patterns (Today)">
      {hourlyData.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#666' }} />
              <YAxis yAxisId="left" label={{ value: 'Value', angle: -90, position: 'insideLeft', fontSize: 12, dy:40, fill: '#666' }} tick={{ fontSize: 11, fill: '#666' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg Score', angle: 90, position: 'insideRight', fontSize: 12, dy:-20, fill: '#666' }} domain={[0, 10]} tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip />
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              {hourlyData.some(d => d.avgTemperature !== undefined) && <Bar yAxisId="left" dataKey="avgTemperature" fill={COLORS.temperature} name="Avg Temp (°C)" />}
              {hourlyData.some(d => d.avgHumidity !== undefined) && <Bar yAxisId="left" dataKey="avgHumidity" fill={COLORS.humidity} name="Avg Humidity (%)" />}
              {hourlyData.some(d => d.avgAirQuality !== undefined) && <Bar yAxisId="left" dataKey="avgAirQuality" fill={COLORS.airQuality_ppm} name="Avg AQI (PPM)" />}
              {hourlyData.some(d => d.avgScore !== undefined) && <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke={COLORS.score} strokeWidth={3} name="Avg Score" dot={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
         <p className="text-slate-500 text-center py-10">No hourly pattern data. Check console.</p>
      )}
    </ChartWrapper>
  );
  
  const DistributionChart = () => {
    const scoreDistributionConfig = [
      { range: '0-2', min: 0, max: 2, count: 0, color: '#ef4444' },
      { range: '2-4', min: 2, max: 4, count: 0, color: '#f97316' },
      { range: '4-6', min: 4, max: 6, count: 0, color: '#eab308' },
      { range: '6-8', min: 6, max: 8, count: 0, color: '#22c55e' },
      { range: '8-10', min: 8, max: 10, count: 0, color: '#16a34a' }
    ];
    let hasScoreDataForDistribution = false;

    if (historicalData.length > 0) {
      historicalData.forEach(d => {
        if (d.score != null && !isNaN(d.score)) {
          hasScoreDataForDistribution = true;
          for (let bin of scoreDistributionConfig) {
            if (d.score >= bin.min && d.score < bin.max) { bin.count++; break; }
            if (bin.max === 10 && d.score === 10) { bin.count++; break; }
          }
        }
      });
    }
    const finalDistributionData = scoreDistributionConfig.filter(d => d.count > 0);

    return (
      <ChartWrapper title="Score Distribution">
        {hasScoreDataForDistribution && finalDistributionData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalDistributionData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="count"
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x  = cx + (radius + 25) * Math.cos(-midAngle * RADIAN);
                    const y = cy  + (radius + 25) * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="#4A5568" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
                        {`${finalDistributionData[index].range} (${(percent * 100).toFixed(0)}%)`}
                      </text>
                    );
                  }}
                >
                  {finalDistributionData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} /> ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => [`${value} readings`, `Range: ${props.payload.payload.range}`]} />
                <Legend wrapperStyle={{fontSize: "12px"}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-10">No score data for distribution.</p>
        )}
      </ChartWrapper>
    );
  };

  const CorrelationChart = () => (
    <ChartWrapper title="Temperature vs Humidity Correlation">
      {historicalData.length > 0 && historicalData.some(d => d.temperature !== undefined && d.humidity !== undefined) ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={historicalData.filter(d => d.temperature !== undefined && d.humidity !== undefined)} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#e0e0e0"/>
              <XAxis type="number" dataKey="temperature" name="Temperature" unit="°C" tick={{ fontSize: 11, fill: '#666' }} />
              <YAxis type="number" dataKey="humidity" name="Humidity" unit="%" tick={{ fontSize: 11, fill: '#666' }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Readings" fill={COLORS.default} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-slate-500 text-center py-10">Insufficient data for correlation.</p>
      )}
    </ChartWrapper>
  );

  const RadarChartComponent = () => {
    const radarMetrics = [];
    const currentStats = statistics;
    const scaleTemp = (val) => Math.min(10, Math.max(0, 10 - Math.abs(val - 22) / 2));
    const scaleHumidity = (val) => Math.min(10, Math.max(0, 10 - Math.abs(val - 50) / 5));
    const scaleAirQuality = (val) => Math.max(0, 10 - (val / 100));
    const scaleSound = (val) => Math.max(0, 10 - (val * 20));

    if (currentStats.temperature && currentStats.temperature.latest !== 'N/A') radarMetrics.push({ metric: 'Temp', current: scaleTemp(currentStats.temperature.latest), optimal: 8, fullMark: 10 });
    if (currentStats.humidity && currentStats.humidity.latest !== 'N/A') radarMetrics.push({ metric: 'Humidity', current: scaleHumidity(currentStats.humidity.latest), optimal: 7, fullMark: 10 });
    if (currentStats.airQuality_ppm && currentStats.airQuality_ppm.latest !== 'N/A') radarMetrics.push({ metric: 'Air Qual.', current: scaleAirQuality(currentStats.airQuality_ppm.latest), optimal: 7, fullMark: 10 });
    if (currentStats.soundLevel && currentStats.soundLevel.latest !== 'N/A') radarMetrics.push({ metric: 'Sound', current: scaleSound(currentStats.soundLevel.latest), optimal: 8, fullMark: 10 });

    return (
      <ChartWrapper title="Current vs Optimal Conditions (Scaled 0-10)">
        {radarMetrics.length >= 3 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={radarMetrics}>
                <PolarGrid gridType="circle" stroke="#e0e0e0"/>
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#666' }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10, fill: '#666' }} />
                <Radar name="Current" dataKey="current" stroke={COLORS.score} fill={COLORS.score} fillOpacity={0.6} />
                <Radar name="Optimal Target" dataKey="optimal" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                <Legend wrapperStyle={{fontSize: "12px"}}/>
                <Tooltip />
              </RechartsRadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-10">Insufficient data for radar chart.</p>
        )}
      </ChartWrapper>
    );
  };
  
  // --- StatisticsCards: Enhanced UI ---
  const StatisticsCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
      {Object.keys(statistics).length > 0 ? Object.entries(statistics).map(([key, stats]) => {
        const IconComponent = METRIC_ICONS[key] || Activity; // Fallback icon
        const color = COLORS[key] || COLORS.default;
        const title = key.replace('_ppm', ' (PPM)').replace(/([A-Z])/g, ' $1').trim();

        return (
          <div 
            key={key} 
            className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 ease-out"
            style={{ borderTop: `4px solid ${color}` }}
          >
            <div className="p-5">
              <div className="flex items-center mb-3">
                <IconComponent className="w-7 h-7 mr-3" style={{ color: color }} />
                <h3 className="text-md font-semibold text-slate-700 capitalize">
                  {title}
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500">Current:</span>
                  <span className="font-bold text-lg" style={{ color: color }}>{stats.latest}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Average:</span>
                  <span className="font-medium text-slate-600">{stats.avg}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Range:</span>
                  <span className="font-medium text-slate-600">
                    {stats.min !== 'N/A' && stats.max !== 'N/A' ? `${stats.min} - ${stats.max}` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      }) : (
        <p className="text-slate-500 col-span-full text-center py-4">No statistics available yet.</p>
      )}
    </div>
  );

  // --- Loading and Error States: Enhanced UI ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-blue-500"></div>
        <p className="mt-6 text-xl text-slate-600 font-medium">Loading Analytics Data...</p>
        <p className="text-slate-500">Please wait a moment.</p>
      </div>
    );
  }

  if (error && !loading) { 
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center bg-white p-10 rounded-xl shadow-2xl max-w-md">
          <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-slate-800 mb-3">Oops! Error Loading Data</h2>
          <p className="text-red-600 mb-6 text-base">{error}</p>
          <p className="text-sm text-slate-500 mb-8">
            Please check your browser's developer console (F12) for technical details.
            Ensure your Firebase connection and data structure are correct.
          </p>
          <button
            onClick={onBack}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 mx-auto text-lg font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  // --- Main Dashboard JSX ---
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-full mx-auto"> {/* Changed from max-w-7xl to full for wider layout */}
        {/* Header Section */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="self-start md:self-center flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors mb-4 md:mb-0 text-sm font-medium group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Dashboard</span>
            </button>
            <div className="flex items-center space-x-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button 
                onClick={() => { /* Export logic remains the same */
                    if (historicalData.length === 0) { alert("No data to export."); return; }
                    const headers = Object.keys(historicalData[0]).join(',');
                    const csvData = historicalData.map(row => Object.values(row).map(val => typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val).join(',')).join('\n');
                    const blob = new Blob([headers + '\n' + csvData], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    if (link.download !== undefined) {
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `environmental_analytics_${timeRange}.csv`);
                        link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
                    }
                }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg">
                <Download className="w-4 h-4" />
                <span>Export Data</span>
              </button>
            </div>
          </div>
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Environmental Analytics</h1>
            <p className="text-slate-600 mt-2 text-lg">Comprehensive insights into your living conditions.</p>
          </div>
        </header>

        {/* Statistics Cards */}
        <StatisticsCards />

        {/* Tab Navigation */}
        <div className="mb-8 flex justify-center">
          <div className="border-b border-slate-300">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {[
                { id: 'trends', label: 'Trends', icon: TrendingUpIcon }, // Using specific icons
                { id: 'patterns', label: 'Patterns', icon: BarChartBig },
                { id: 'analysis', label: 'Analysis', icon: ActivityIcon }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-base transition-colors duration-200 ${
                    activeTab === id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Chart Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {activeTab === 'trends' && (
            <>
              <TrendChart />
              <ScoreChart />
            </>
          )}
          
          {activeTab === 'patterns' && (
            <>
              <HourlyPatternChart />
              <RadarChartComponent />
            </>
          )}
          
          {activeTab === 'analysis' && (
            <>
              <DistributionChart />
              <CorrelationChart />
            </>
          )}
        </div>
        {/* Footer (Optional) */}
        <footer className="text-center mt-12 py-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">© {new Date().getFullYear()} Living Condition Monitoring. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;