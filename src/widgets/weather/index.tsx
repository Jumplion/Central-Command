import { useState, useEffect, useCallback } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import { WidgetLoading } from '../_shared';
import {
  REFRESH_INTERVAL_MS,
  CACHE_KEY,
  DEFAULT_LOCATION,
  OPEN_METEO_URL,
  GEOCODING_URL,
  getWmoInfo,
} from './constants';
import type { WeatherData, ForecastDay } from './types';

function toF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function fmtTemp(celsius: number, units: string): string {
  return units === 'fahrenheit' ? `${toF(celsius)}°F` : `${Math.round(celsius)}°C`;
}

function fmtWind(kmh: number, units: string): string {
  return units === 'fahrenheit'
    ? `${Math.round(kmh * 0.621371)} mph`
    : `${Math.round(kmh)} km/h`;
}

function dayAbbr(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ForecastCard({ day, units }: { day: ForecastDay; units: string }) {
  const wmo = getWmoInfo(day.weatherCode);
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 2px',
        background: 'var(--panel-2)',
        borderRadius: 'var(--radius)',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{dayAbbr(day.date)}</div>
      <div style={{ fontSize: 20 }}>{wmo.emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{fmtTemp(day.tempMax, units)}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmtTemp(day.tempMin, units)}</div>
    </div>
  );
}

function WeatherWidget({ api, settings, setTitle }: WidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const location = String(settings.location ?? DEFAULT_LOCATION);
  const units = String(settings.units ?? 'celsius');

  const fetchWeather = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = await api.kv.get<WeatherData>(CACHE_KEY);
        if (
          cached &&
          cached.locationKey === location &&
          Date.now() - cached.timestamp < REFRESH_INTERVAL_MS
        ) {
          setWeather(cached);
          setLoading(false);
          return;
        }
      }

      try {
        setRefreshing(true);

        let lat: number, lon: number, locationName: string;

        const latLonMatch = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/.exec(location);
        if (latLonMatch) {
          lat = parseFloat(latLonMatch[1]);
          lon = parseFloat(latLonMatch[2]);
          locationName = location;
        } else {
          const geoResp = await api.net.fetch(
            `${GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
          );
          const geoData = JSON.parse(geoResp.body) as {
            results?: Array<{
              latitude: number;
              longitude: number;
              name: string;
              country: string;
              admin1?: string;
            }>;
          };
          if (!geoData.results?.length) throw new Error(`Location "${location}" not found`);
          const r = geoData.results[0];
          lat = r.latitude;
          lon = r.longitude;
          locationName = r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`;
        }

        const params = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          current:
            'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
          daily:
            'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum',
          timezone: 'auto',
          forecast_days: '6',
        });

        const resp = await api.net.fetch(`${OPEN_METEO_URL}?${params}`);
        const data = JSON.parse(resp.body) as {
          current: {
            temperature_2m: number;
            apparent_temperature: number;
            relative_humidity_2m: number;
            wind_speed_10m: number;
            weather_code: number;
          };
          daily: {
            time: string[];
            temperature_2m_max: number[];
            temperature_2m_min: number[];
            weather_code: number[];
            precipitation_sum: number[];
          };
        };

        const weatherData: WeatherData = {
          timestamp: Date.now(),
          locationKey: location,
          locationName,
          lat,
          lon,
          current: {
            temp: data.current.temperature_2m,
            feelsLike: data.current.apparent_temperature,
            humidity: data.current.relative_humidity_2m,
            windSpeed: data.current.wind_speed_10m,
            weatherCode: data.current.weather_code,
          },
          forecast: data.daily.time.slice(1, 6).map((date, i) => ({
            date,
            tempMax: data.daily.temperature_2m_max[i + 1],
            tempMin: data.daily.temperature_2m_min[i + 1],
            weatherCode: data.daily.weather_code[i + 1],
            precipitationSum: data.daily.precipitation_sum[i + 1] ?? 0,
          })),
        };

        await api.kv.set(CACHE_KEY, weatherData);
        setWeather(weatherData);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [api, location],
  );

  useEffect(() => {
    void fetchWeather();
  }, [fetchWeather]);

  useEffect(() => {
    const id = setInterval(() => void fetchWeather(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchWeather]);

  useEffect(() => {
    if (weather) setTitle(weather.locationName);
    return () => setTitle(undefined);
  }, [weather, setTitle]);

  if (loading) return <WidgetLoading />;

  if (error && !weather) {
    return (
      <div style={{ padding: 12, color: 'var(--danger)', fontSize: 12 }}>
        {error}
      </div>
    );
  }

  if (!weather) return null;

  const { current, forecast } = weather;
  const wmo = getWmoInfo(current.weatherCode);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '10px 12px',
        boxSizing: 'border-box',
        gap: 10,
      }}
    >
      {/* Current conditions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 44, lineHeight: 1, flexShrink: 0 }}>{wmo.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
            {fmtTemp(current.temp, units)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
            {wmo.label}
          </div>
        </div>
        <button
          className="ghost small"
          style={{ fontSize: 13, padding: '2px 7px', flexShrink: 0 }}
          disabled={refreshing}
          onClick={() => void fetchWeather(true)}
          title="Refresh weather"
        >
          {refreshing ? '…' : '↺'}
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatItem label="Feels like" value={fmtTemp(current.feelsLike, units)} />
        <StatItem label="Humidity" value={`${current.humidity}%`} />
        <StatItem label="Wind" value={fmtWind(current.windSpeed, units)} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* 5-day forecast */}
      <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'stretch' }}>
        {forecast.map((day) => (
          <ForecastCard key={day.date} day={day} units={units} />
        ))}
      </div>

      {/* Last updated */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
        Updated{' '}
        {new Date(weather.timestamp).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: 'weather',
    name: 'Weather',
    description:
      'Current conditions and 5-day forecast via Open-Meteo — no API key required',
    version: '0.1.0',
    icon: '🌤️',
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 4 },
    settings: [
      {
        kind: 'string',
        key: 'location',
        label: 'Location',
        default: DEFAULT_LOCATION,
        placeholder: 'City name or lat,lon (e.g. 40.71,-74.01)',
      },
      {
        kind: 'select',
        key: 'units',
        label: 'Temperature units',
        default: 'celsius',
        options: [
          { value: 'celsius', label: 'Celsius (°C)' },
          { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
        ],
      },
    ],
  },
  Component: WeatherWidget,
};

export default widget;
