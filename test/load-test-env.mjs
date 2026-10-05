import { config } from 'dotenv';

// override: values in .env.test win over anything already set (including .env)
config({ path: '.env.test', override: true, quiet: true });

const databaseName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to run e2e tests against database "${databaseName}": its name must end in "_test" ` +
      'because the tests delete all data. Check DATABASE_URL in .env.test.',
  );
}
