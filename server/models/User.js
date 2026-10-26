const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    whatsapp: {
      enabled: {
        type: Boolean,
        default: false
      },
      phoneNumber: {
        type: String,
        default: ''
      },
      verified: {
        type: Boolean,
        default: false
      }
    },
    weatherLocation: {
      type: new mongoose.Schema({
        name: { type: String, required: true, maxlength: 160 },
        latitude: { type: Number, required: true, min: -90, max: 90 },
        longitude: { type: Number, required: true, min: -180, max: 180 }
      }, { _id: false }),
      default: null
    },
    groqKeyEncrypted: { type: String, select: false },
    aiSettings: {
      enabled: { type: Boolean, default: false },
      model: { type: String, default: 'openai/gpt-oss-20b' },
      timezone: { type: String, default: 'Asia/Colombo' },
      workdayStart: { type: String, default: '08:00' },
      workdayEnd: { type: String, default: '18:00' },
      defaultDuration: { type: Number, default: 30 }
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
      },
      timezone: {
        type: String,
        default: 'UTC'
      },
      defaultReminder: {
        type: Number, // minutes before due date
        default: 15
      }
    }
  },
  {
    timestamps: true
  }
);

userSchema.set('toJSON', { transform(doc, value) {
  delete value.passwordHash;
  delete value.groqKeyEncrypted;
  return value;
} });
module.exports = mongoose.model('User', userSchema);
