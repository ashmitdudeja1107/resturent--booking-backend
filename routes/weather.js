const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

const DEFAULT_LOCATION = {
  city: 'Mumbai',
  lat: 19.0760,
  lon: 72.8777
};

function emitSocketEvent(req, eventName, data, room = null) {
  const io = req.app.get('io');
  if (io) {
    if (room) io.to(room).emit(eventName, data);
    else io.emit(eventName, data);
  }
}

function getSeatingRecommendation(weather) {
  const condition = weather.weather[0].main.toLowerCase();
  const temp = weather.main.temp;
  const description = weather.weather[0].description;

  let recommendation = {
    seatingPreference: 'indoor',
    message: '',
    condition,
    temperature: temp,
    description
  };

  if (condition === 'clear' && temp >= 20 && temp <= 30) {
    recommendation.seatingPreference = 'outdoor';
    recommendation.message = `Perfect weather for outdoor dining! It's ${temp.toFixed(1)}°C with clear skies. Would you like a table on our terrace?`;
  } else if (condition === 'clouds' && temp >= 18 && temp <= 28) {
    recommendation.seatingPreference = 'outdoor';
    recommendation.message = `Pleasant weather with ${description}. Temperature is ${temp.toFixed(1)}°C - great for outdoor seating!`;
  } else if (['rain', 'drizzle', 'thunderstorm'].includes(condition)) {
    recommendation.seatingPreference = 'indoor';
    recommendation.message = `Looks like ${description}. I'd recommend our cozy indoor area where you'll be comfortable.`;
  } else if (temp > 35) {
    recommendation.seatingPreference = 'indoor';
    recommendation.message = `It's going to be quite hot at ${temp.toFixed(1)}°C. Indoor seating is more comfortable.`;
  } else if (temp < 15) {
    recommendation.seatingPreference = 'indoor';
    recommendation.message = `Temperature will be ${temp.toFixed(1)}°C - a bit chilly. Indoor seating would be perfect.`;
  } else {
    recommendation.seatingPreference = 'no preference';
    recommendation.message = `Weather looks moderate with ${description}. Indoor and outdoor seating are available. Any preference?`;
  }

  return recommendation;
}

router.get('/current', async (req, res) => {
  try {
    const { city, lat, lon } = req.query;
    let url = `${WEATHER_BASE_URL}/weather?appid=${WEATHER_API_KEY}&units=metric`;

    if (lat && lon) url += `&lat=${lat}&lon=${lon}`;
    else if (city) url += `&q=${city}`;
    else url += `&lat=${DEFAULT_LOCATION.lat}&lon=${DEFAULT_LOCATION.lon}`;

    const response = await axios.get(url);
    const weatherData = response.data;

    const result = {
      location: weatherData.name,
      temperature: weatherData.main.temp,
      feelsLike: weatherData.main.feels_like,
      condition: weatherData.weather[0].main,
      description: weatherData.weather[0].description,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      timestamp: new Date(weatherData.dt * 1000)
    };

    emitSocketEvent(req, 'weather-current', {
      weather: result,
      message: 'Current weather updated',
      timestamp: new Date()
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current weather',
      message: error.response?.data?.message || error.message
    });
  }
});

router.get('/forecast', async (req, res) => {
  try {
    const { date, city, lat, lon } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }

    let url = `${WEATHER_BASE_URL}/forecast?appid=${WEATHER_API_KEY}&units=metric`;

    if (lat && lon) url += `&lat=${lat}&lon=${lon}`;
    else if (city) url += `&q=${city}`;
    else url += `&lat=${DEFAULT_LOCATION.lat}&lon=${DEFAULT_LOCATION.lon}`;

    const response = await axios.get(url);
    const forecastData = response.data;

    const requestedDate = new Date(date);
    requestedDate.setHours(12, 0, 0, 0);

    const match = forecastData.list.find(item => {
      const d = new Date(item.dt * 1000);
      return d.toDateString() === requestedDate.toDateString();
    });

    const selected = match || forecastData.list.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.dt * 1000) - requestedDate);
      const currDiff = Math.abs(new Date(curr.dt * 1000) - requestedDate);
      return currDiff < prevDiff ? curr : prev;
    });

    const recommendation = getSeatingRecommendation(selected);

    const result = {
      location: forecastData.city.name,
      date: new Date(selected.dt * 1000),
      temperature: selected.main.temp,
      feelsLike: selected.main.feels_like,
      condition: selected.weather[0].main,
      description: selected.weather[0].description,
      humidity: selected.main.humidity,
      windSpeed: selected.wind.speed,
      recommendation: recommendation.message,
      suggestedSeating: recommendation.seatingPreference
    };

    emitSocketEvent(req, 'weather-forecast', {
      weather: result,
      timestamp: new Date(),
      isClosest: !match
    });

    res.json({
      success: true,
      message: match ? undefined : 'Closest forecast used',
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather forecast',
      message: error.response?.data?.message || error.message
    });
  }
});

router.post('/recommendation', async (req, res) => {
  try {
    const { date, city, lat, lon, sessionId } = req.body;

    if (!date) {
      return res.json({
        success: false,
        error: 'Date is required'
      });
    }

    let url = `${WEATHER_BASE_URL}/forecast?appid=${WEATHER_API_KEY}&units=metric`;

    if (lat && lon) url += `&lat=${lat}&lon=${lon}`;
    else if (city) url += `&q=${city}`;
    else url += `&lat=${DEFAULT_LOCATION.lat}&lon=${DEFAULT_LOCATION.lon}`;

    emitSocketEvent(req, 'weather-fetching', {
      sessionId,
      message: 'Checking weather...',
      timestamp: new Date()
    }, sessionId);

    const response = await axios.get(url);
    const forecastData = response.data;

    const requestedDate = new Date(date);
    requestedDate.setHours(12, 0, 0, 0);

    const match = forecastData.list.find(item => {
      const d = new Date(item.dt * 1000);
      return d.toDateString() === requestedDate.toDateString();
    }) || forecastData.list[0];

    const recommendation = getSeatingRecommendation(match);

    const result = {
      weatherInfo: {
        condition: recommendation.condition,
        temperature: recommendation.temperature,
        description: recommendation.description,
        humidity: match.main.humidity,
        windSpeed: match.wind.speed,
        date: new Date(match.dt * 1000)
      },
      seatingPreference: recommendation.seatingPreference,
      voiceMessage: recommendation.message,
      isSuggestion: true,
      note: 'This is a weather-based suggestion'
    };

    emitSocketEvent(req, 'weather-recommendation', {
      sessionId,
      weather: result.weatherInfo,
      seatingPreference: result.seatingPreference,
      message: result.voiceMessage,
      isSuggestion: true,
      timestamp: new Date()
    }, sessionId);

    emitSocketEvent(req, 'seating-suggestion', {
      sessionId,
      seatingPreference: result.seatingPreference,
      reason: recommendation.message,
      isSuggestion: true,
      timestamp: new Date()
    }, sessionId);

    res.json({ success: true, data: result });

  } catch (error) {
    emitSocketEvent(req, 'weather-error', {
      sessionId: req.body.sessionId,
      error: error.message,
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get recommendation',
      message: error.response?.data?.message || error.message,
      fallback: {
        voiceMessage: 'Unable to fetch weather data. Please choose seating manually.',
        seatingPreference: 'no preference',
        weatherInfo: null,
        isSuggestion: true
      }
    });
  }
});

router.get('/test-key', (req, res) => {
  res.json({
    keyExists: !!WEATHER_API_KEY,
    keyLength: WEATHER_API_KEY?.length,
    firstChars: WEATHER_API_KEY?.substring(0, 5)
  });
});

module.exports = router;
