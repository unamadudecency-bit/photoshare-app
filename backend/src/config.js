require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  storage: {
    connectionString: process.env.STORAGE_CONNECTION_STRING || '',
    container: 'photos'
  },
  cosmos: {
    endpoint: process.env.COSMOS_ENDPOINT || '',
    key: process.env.COSMOS_KEY || '',
    database: 'photoshare'
  },
  vision: {
    endpoint: process.env.VISION_ENDPOINT || '',
    key: process.env.VISION_KEY || ''
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: '24h'
  },
  // When true, we use in-memory mocks instead of Azure (for local dev)
  useMocks: process.env.USE_MOCKS === 'true' || !process.env.COSMOS_ENDPOINT
};