// Environment configuration for backend
require('dotenv').config();

const config = {
  development: {
    PORT: process.env.PORT || 4000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000/api',
    ENVIRONMENT: 'development',
    CORS_ORIGINS: ['http://localhost:5173', 'http://localhost:3000']
  },
  production: {
    PORT: process.env.PORT || 5000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://103.27.234.248',
    BACKEND_URL: process.env.BACKEND_URL || 'http://103.27.234.248:5000',
    API_BASE_URL: process.env.API_BASE_URL || 'http://103.27.234.248:5000/api',
    ENVIRONMENT: 'production',
    CORS_ORIGINS: [
      process.env.FRONTEND_URL || 'http://103.27.234.248',
      'http://103.27.234.248',
      'http://103.27.234.248:5173',  // ✅ Add this for your current frontend port
      'http://103.27.234.248:3000',  // ✅ Add this for alternative port
      'http://103.27.234.248:8080' 
    ]
  }
};

// Get current environment
const currentEnv = process.env.NODE_ENV || 'development';

// Export current environment config
const environment = config[currentEnv];

// Export individual values for convenience
const PORT = environment.PORT;
const DATABASE_URL = environment.DATABASE_URL;
const JWT_SECRET = environment.JWT_SECRET;
const FRONTEND_URL = environment.FRONTEND_URL;
const BACKEND_URL = environment.BACKEND_URL;
const API_BASE_URL = environment.API_BASE_URL;
const ENVIRONMENT = environment.ENVIRONMENT;
const CORS_ORIGINS = environment.CORS_ORIGINS;

// Helper function to get full API URL
const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

module.exports = {
  environment,
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  FRONTEND_URL,
  BACKEND_URL,
  API_BASE_URL,
  ENVIRONMENT,
  CORS_ORIGINS,
  getApiUrl
};
