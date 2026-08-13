import { createElement } from 'react'
import {
  Sun, Moon, Cloud, CloudSun, CloudMoon, CloudFog, CloudRain, CloudSnow, CloudLightning,
} from 'lucide-react'

// Shared weather display helpers — extracted out of ItineraryPage.jsx so
// DashboardPage.jsx (and anywhere else showing a condition string/hour) can
// use the exact same icon mapping and hour formatting without duplicating
// them. Pure, self-contained: no dependency on any page-local state.

export const weatherIcon = (condition, timeStr) => {
  const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
  const isNight = hour < 6 || hour >= 20;
  const cond = (condition || '').toLowerCase();
  if (cond.includes('clear')) return isNight ? Moon : Sun;
  if (cond.includes('partly cloudy')) return isNight ? CloudMoon : CloudSun;
  if (cond.includes('overcast')) return Cloud;
  if (cond.includes('fog')) return CloudFog;
  if (cond.includes('snow')) return CloudSnow;
  if (cond.includes('thunder')) return CloudLightning;
  return CloudRain;
};

// Helper: Weather Icon Component. Written with createElement (not JSX) so
// this file can stay a plain .js module regardless of build-tool JSX
// handling for that extension.
export function WeatherIcon({ condition, timeStr, className }) {
  const Icon = weatherIcon(condition, timeStr);
  return createElement(Icon, { className });
}

export const formatHour = (timeStr) => {
  const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};
