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
  Thermometer, Droplets, Wind, Volume2, Award, TrendingUpIcon, BarChartBig, ActivityIcon, Maximize
} from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

const FIREBASE_CONFIG = {
  databaseURL: "https://living-condition-monitoring-default-rtdb.asia-southeast1.firebasedatabase.app"
};

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const COLORS = {
  temperature: '#ef4444',
  humidity: '#3b82f6',
  airQuality_ppm: '#22c55e',
  soundLevel: '#f59e0b',
  score: '#8b5cf6',
  default: '#6b7280'
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
  const [historicalData, setHistoricalData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trends');

  useEffect(() => {
    // MODIFIED: Expects startTimeInSeconds
    const fetchHistoricalData = async (startTimeInSeconds) => {
      console.log("Fetching historical data starting from Firebase timestamp (expected seconds):", startTimeInSeconds);
      const dataRef = firebase.database().ref('environmental_data');
      try {
        // MODIFIED: Querying with startTimeInSeconds, assuming 'timestamp' in Firebase is in seconds
        const snapshot = await dataRef.orderByChild('timestamp').startAt(startTimeInSeconds).once('value');
        
        if (!snapshot.exists()) {
          console.warn("Snapshot does not exist for 'environmental_data' with startAt (seconds):", startTimeInSeconds);
          return [];
        }

        const rawData = snapshot.val();
        if (!rawData || typeof rawData !== 'object') {
            console.warn("Raw data from Firebase for 'environmental_data' is not a valid object or is null:", rawData);
            return [];
        }
        
        const processedData = Object.keys(rawData).map(key => {
          const record = rawData[key];
          if (!record || typeof record !== 'object') {
            console.warn(`Skipping invalid historical record for key ${key}:`, record);
            return null;
          }

          let firebaseTimestamp = record.timestamp; // Assumed to be in SECONDS from Firebase

          if (typeof firebaseTimestamp === 'string') {
            const parsed = parseInt(firebaseTimestamp, 10);
            if (!isNaN(parsed)) {
              firebaseTimestamp = parsed;
            } else {
              console.warn(`Could not parse timestamp string to number for key ${key}:`, record.timestamp);
              return null; 
            }
          }
          
          // Validate the Firebase timestamp (seconds)
          if (typeof firebaseTimestamp !== 'number' || isNaN(firebaseTimestamp) || firebaseTimestamp <= 0) { 
            console.warn(`Skipping historical record with invalid, zero, or negative Firebase timestamp (key: ${key}). Original TS: ${record.timestamp}, Parsed TS: ${firebaseTimestamp}. Record:`, record);
            return null;
          }

          // MODIFIED: Convert SECONDS from Firebase to MILLISECONDS for JavaScript Date
          const timestampMs = firebaseTimestamp * 1000;
          // console.log(`Key: ${key}, Firebase TS (s): ${firebaseTimestamp}, Converted TS (ms): ${timestampMs}`);


          const dateObj = new Date(timestampMs);
          // If timestampMs was 0 (due to firebaseTimestamp being 0), dateObj.getFullYear() would be 1970.
          // We filter out such records as they usually indicate missing or corrupt data for time-series.
          if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1971) { 
            console.warn(`Skipping historical record: timestamp results in invalid or pre-1971 Date object (key: ${key}, originalFirebaseTS_s: ${firebaseTimestamp}, convertedTS_ms: ${timestampMs}). Record:`, record);
            return null;
          }

          return {
            ...record, 
            timestamp: timestampMs, // CRITICAL: Store the MILLISECONDS timestamp for charts and JS
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
            console.warn("All historical records were filtered out during processing. Check timestamp formats and values in Firebase.");
        } else if (processedData.length === 0) {
             console.warn("No processable historical data found after fetching. Check Firebase path and data structure.");
        }
        processedData.sort((a, b) => a.timestamp - b.timestamp); // Sort by milliseconds timestamp
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
      const currentTimestampMs = Date.now(); // milliseconds
      let startTimeMs;
      switch (timeRange) {
        case '24h': startTimeMs = currentTimestampMs - (24 * 60 * 60 * 1000); break;
        case '7d': startTimeMs = currentTimestampMs - (7 * 24 * 60 * 60 * 1000); break;
        case '30d': startTimeMs = currentTimestampMs - (30 * 24 * 60 * 60 * 1000); break;
        default: startTimeMs = currentTimestampMs - (7 * 24 * 60 * 60 * 1000);
      }
      
      // MODIFIED: Convert startTime to SECONDS for Firebase query
      const startTimeForFirebaseQuerySeconds = Math.floor(startTimeMs / 1000);

      const histData = await fetchHistoricalData(startTimeForFirebaseQuerySeconds); // Pass startTime in seconds
      const hrlyData = await fetchHourlyData(); 
      setHistoricalData(histData);
      setHourlyData(hrlyData);
      setLoading(false);
    };
    loadData();
  // }, [timeRange, error]); // Removed 'error' from deps if it causes loops on persistent errors.
  }, [timeRange]); // Consider if 'error' dependency is needed or if it causes unwanted refetch loops.


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

  // These formatter functions expect timestamp in MILLISECONDS
  const formatXAxisTick = (timestampMs) => {
    if (!timestampMs || timestampMs <= 0) return ''; // Guard against 0 or invalid ms timestamps
    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return ''; // Further guard

    if (timeRange === '24h') return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const formatTooltipLabel = (timestampMs) => {
    if (!timestampMs || timestampMs <= 0) return '';
    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const ChartWrapper = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-slate-700">{title}</h3>
      </div>
      {children}
    </div>
  );

  const TrendChart = () => (
    <ChartWrapper title="Environmental Trends">
      {historicalData.length > 0 ? (
        <div className="h-80"> 
          <ResponsiveContainer width="100%" height="100%">
            {/* XAxis dataKey="timestamp" will use the processed millisecond timestamp */}
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxisTick} 
                tick={{ fontSize: 11, fill: '#666' }} 
                domain={['dataMin', 'dataMax']} 
                type="number" 
              />
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

  const MetricAveragesChart = ({ statsData }) => {
    const chartData = [
      { name: 'Temperature', avg: statsData.temperature?.avg, unit: '°C', fill: COLORS.temperature },
      { name: 'Humidity', avg: statsData.humidity?.avg, unit: '%', fill: COLORS.humidity },
      { name: 'Air Quality', avg: statsData.airQuality_ppm?.avg, unit: 'PPM', fill: COLORS.airQuality_ppm },
      { name: 'Sound Level', avg: statsData.soundLevel?.avg, unit: 'units', fill: COLORS.soundLevel },
    ].filter(item => item.avg !== 'N/A' && item.avg !== undefined && !isNaN(item.avg));

    return (
      <ChartWrapper title="Overall Metric Averages">
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#666' }} width={80} />
                <Tooltip formatter={(value, name, props) => [`${value} ${props.payload.unit || ''}`, "Average"]} />
                <Bar dataKey="avg" name="Average Value" barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-10">No average data available to display.</p>
        )}
      </ChartWrapper>
    );
  };

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
  
  const TemperatureDistributionChart = ({ data }) => {
    const tempBins = [
      { range: '< 15°C', min: -Infinity, max: 15, count: 0, color: '#3b82f6' },
      { range: '15-20°C', min: 15, max: 20, count: 0, color: '#60a5fa' },
      { range: '20-25°C', min: 20, max: 25, count: 0, color: '#22c55e' },
      { range: '25-30°C', min: 25, max: 30, count: 0, color: '#f97316' },
      { range: '> 30°C', min: 30, max: Infinity, count: 0, color: '#ef4444' }
    ];
    let hasTempDataForDistribution = false;

    if (data.length > 0) {
      data.forEach(d => {
        if (d.temperature != null && !isNaN(d.temperature)) {
          hasTempDataForDistribution = true;
          for (let bin of tempBins) {
            if (d.temperature >= bin.min && d.temperature < bin.max) {
              bin.count++;
              break;
            }
          }
        }
      });
    }
    const finalDistributionData = tempBins.filter(bin => bin.count > 0 || hasTempDataForDistribution); 

    return (
      <ChartWrapper title="Temperature Distribution">
        {hasTempDataForDistribution && finalDistributionData.some(bin => bin.count > 0) ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finalDistributionData} margin={{ top: 5, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 11, fill: '#666' }} 
                    angle={-25} 
                    textAnchor="end" 
                    height={50}
                    interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#666' }} />
                <Tooltip formatter={(value, name, props) => [`${value} readings`, `Range: ${props.payload.range}`]} />
                <Bar dataKey="count" name="Readings Count">
                  {finalDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-10">No temperature data for distribution analysis.</p>
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
    const scaleAirQuality = (val) => Math.max(0, 10 - (val / 20)); 
    const scaleSound = (val) => Math.max(0, 10 - (val * 20)); 

    if (currentStats.temperature && currentStats.temperature.latest !== 'N/A') radarMetrics.push({ metric: 'Temp', current: scaleTemp(currentStats.temperature.latest), optimal: 8, fullMark: 10 });
    if (currentStats.humidity && currentStats.humidity.latest !== 'N/A') radarMetrics.push({ metric: 'Humidity', current: scaleHumidity(currentStats.humidity.latest), optimal: 8, fullMark: 10 });
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
  
  const StatisticsCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
      {Object.keys(statistics).length > 0 ? Object.entries(statistics).map(([key, stats]) => {
        const IconComponent = METRIC_ICONS[key] || Activity; 
        const color = COLORS[key] || COLORS.default;
        let title = key.replace('_ppm', ' (PPM)');
        title = title.charAt(0).toUpperCase() + title.slice(1).replace(/([A-Z])/g, ' $1');

        return (
          <div 
            key={key} 
            className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 ease-out"
            style={{ borderTop: `4px solid ${color}` }}
          >
            <div className="p-5">
              <div className="flex items-center mb-3">
                <IconComponent className="w-7 h-7 mr-3" style={{ color: color }} />
                <h3 className="text-md font-semibold text-slate-700">
                  {title}
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-500">Current:</span>
                  <span className="font-bold text-lg" style={{ color: color }}>{stats.latest === undefined || stats.latest === null || isNaN(stats.latest) ? 'N/A' : stats.latest}</span>
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
            Ensure your Firebase connection and data structure (especially timestamp units) are correct.
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

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
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
                onClick={() => { 
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

        <StatisticsCards />

        <div className="mb-8 flex justify-center">
          <div className="border-b border-slate-300">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {[
                { id: 'trends', label: 'Trends', icon: TrendingUpIcon },
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {activeTab === 'trends' && (
            <>
              <TrendChart />
              <MetricAveragesChart statsData={statistics} /> 
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
              <TemperatureDistributionChart data={historicalData} />
              <CorrelationChart />
            </>
          )}
        </div>
        <footer className="text-center mt-12 py-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">© {new Date().getFullYear()} Living Condition Monitoring. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;