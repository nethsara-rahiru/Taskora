const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/taskora',
  jwtSecret: process.env.JWT_SECRET || 'taskora_default_jwt_secret',
  sessionSecret: process.env.SESSION_SECRET || 'taskora_default_session_secret',
  frontDesk: {
    apiUrl: process.env.FRONTDESK_API_URL || '',
    apiKey: process.env.FRONTDESK_API_KEY || '',
    agentId: process.env.FRONTDESK_AGENT_ID || ''
  }
};
