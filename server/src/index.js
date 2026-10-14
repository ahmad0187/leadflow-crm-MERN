import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

await mongoose.connect(config.mongoUrl);
console.log('Connected to MongoDB');

const server = createApp().listen(config.port, () => console.log(`LeadFlow API on http://localhost:${config.port}`));

const shutdown = async () => {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
