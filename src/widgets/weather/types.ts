export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  weatherCode: number;
  precipitationSum: number;
}

export interface WeatherData {
  timestamp: number;
  locationKey: string;
  locationName: string;
  lat: number;
  lon: number;
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
  };
  forecast: ForecastDay[];
}
