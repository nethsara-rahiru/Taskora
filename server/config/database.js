const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`[Taskora DB] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Taskora DB Error] ${error.message}`);
    console.warn(`[Taskora DB Warning] Running with MongoDB connection pending. Ensure local MongoDB is running at ${config.mongoUri}`);
  }
};

module.exports = connectDB;
