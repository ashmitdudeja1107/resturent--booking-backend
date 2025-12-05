# Restaurant Booking Backend

A Node.js backend API for managing restaurant bookings with weather integration and AI conversation capabilities.

## Features

- **Booking Management**: Create, read, update, and delete restaurant bookings
- **Weather Integration**: Check weather conditions for booking locations
- **AI Conversation**: AI-powered chatbot for customer inquiries
- **Input Validation**: Comprehensive validation for booking data
- **MongoDB Integration**: Persistent data storage with MongoDB

## Project Structure

```
restaurant-booking-backend/
├── server.js                 # Main server file
├── models/
│   └── Booking.js           # MongoDB schema
├── routes/
│   ├── bookings.js          # Booking CRUD endpoints
│   ├── weather.js           # Weather API integration
│   └── agent.js             # AI conversation logic
├── middleware/
│   └── validation.js        # Input validation
├── package.json
├── .env.example
└── README.md
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd restaurant-booking-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/restaurant-booking
WEATHER_API_KEY=your_openweathermap_api_key_here
```

## Running the Application

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on the port specified in your `.env` file (default: 5000).

## API Endpoints

### Bookings
- `POST /api/bookings` - Create a new booking
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get a specific booking
- `PUT /api/bookings/:id` - Update a booking
- `DELETE /api/bookings/:id` - Delete a booking

### Weather
- `GET /api/weather/:location` - Get weather data for a location

### AI Agent
- `POST /api/agent/chat` - Send a message to the AI agent
- `GET /api/agent/history/:sessionId` - Get conversation history

## Requirements

- Node.js (v14+)
- MongoDB
- Weather API Key (from OpenWeatherMap)

## Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `WEATHER_API_KEY` - OpenWeatherMap API key

## License

MIT
