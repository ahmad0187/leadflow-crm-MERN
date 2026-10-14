import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: { NODE_ENV: 'test', ANTHROPIC_API_KEY: '', MONGO_URL: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/leadflow_test' },
  },
});
