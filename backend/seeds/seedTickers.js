const mongoose = require('mongoose');
const Ticker = require('../models/Tickers'); // ajusta la ruta si hace falta

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI;

const tickers = [
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'WBD', name: 'Warner Bros. Discovery, Inc.' },
  { symbol: 'SBUX', name: 'Starbucks Corporation' },
  { symbol: 'SQ', name: 'Block, Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated' },
  { symbol: 'FOX', name: 'Fox Corporation' },
  { symbol: 'CHTR', name: 'Charter Communications, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'CMCSA', name: 'Comcast Corporation' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.' },
  { symbol: 'HON', name: 'Honeywell International Inc.' },
  { symbol: 'WBA', name: 'Walgreens Boots Alliance, Inc.' },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.' },
  { symbol: 'MAR', name: 'Marriott International, Inc.' },
  { symbol: 'AMGN', name: 'Amgen Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.' }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🟢 Mongo conectado');

    for (const t of tickers) {
      await Ticker.updateOne(
        { symbol: t.symbol },
        {
          $set: {
            name: t.name,
            description: t.name,
            exchange: 'NASDAQ',
            currency: 'USD',
            active: true
          }
        },
        { upsert: true }
      );
    }

    console.log('✅ Seed completado');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  }
}

seed();