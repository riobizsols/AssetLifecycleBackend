// Environment configuration for backend
require('dotenv').config();

// Main domain for subdomain-based multi-tenancy
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'riowebworks.net';

const config = {
  development: {
    PORT: process.env.PORT || 4000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000/api',
    ENVIRONMENT: 'development',
    MAIN_DOMAIN: MAIN_DOMAIN,
    CORS_ORIGINS: [
      'http://localhost:5173', 
      'http://localhost:3000',
      // Allow all subdomains for development
      /^http:\/\/.*\.localhost:\d+$/
    ]
  },
  production: {
    PORT: process.env.PORT || 5000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || `https://${MAIN_DOMAIN}`,
    BACKEND_URL: process.env.BACKEND_URL || `https://api.${MAIN_DOMAIN}`,
    API_BASE_URL: process.env.API_BASE_URL || `https://api.${MAIN_DOMAIN}/api`,
    ENVIRONMENT: 'production',
    MAIN_DOMAIN: MAIN_DOMAIN,
    CORS_ORIGINS: [
      `https://${MAIN_DOMAIN}`,
      `http://${MAIN_DOMAIN}`,
      // Allow all subdomains of riowebworks.net
      new RegExp(`^https?://.*\\.${MAIN_DOMAIN.replace(/\./g, '\\.')}$`),
      // Also allow IP-based access for backward compatibility
      'http://103.27.234.248',
      'http://103.27.234.248:5173',
      'http://103.27.234.248:3000',
      'http://103.27.234.248:8080',
      'https://103.27.234.248',
      'https://103.27.234.248:5173'
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
// MAIN_DOMAIN is already defined at the top of the file
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
  MAIN_DOMAIN,
  CORS_ORIGINS,
  getApiUrl
};
