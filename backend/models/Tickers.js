const mongoose = require('mongoose');

const TickersSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  exchange: {
    type: String,
    default: 'NASDAQ'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice único por símbolo
TickersSchema.index({ symbol: 1 }, { unique: true });

module.exports = mongoose.model('Tickers', TickersSchema);