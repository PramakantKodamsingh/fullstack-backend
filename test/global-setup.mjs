import { execSync } from 'node:child_process';
import './load-test-env.mjs';

// Bring the test database up to date with prisma/migrations before any test runs
export default function globalSetup() {
  execSync('node node_modules/prisma/build/index.js migrate deploy', {
    env: process.env,
    stdio: 'pipe',
  });
}
