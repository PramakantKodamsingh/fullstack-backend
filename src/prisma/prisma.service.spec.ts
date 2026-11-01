import { describeDatabaseUrl } from './prisma.service.js';

describe('describeDatabaseUrl', () => {
  it('should show host, port, database and user', () => {
    expect(
      describeDatabaseUrl('postgresql://postgres:root@localhost:5433/fullstack_docker?schema=public'),
    ).toBe('localhost:5433/fullstack_docker (user postgres)');
  });

  it('should never include the password', () => {
    const result = describeDatabaseUrl(
      'postgresql://neondb_owner:super-secret@ep-x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    );

    expect(result).toBe('ep-x.ap-southeast-1.aws.neon.tech:5432/neondb (user neondb_owner)');
    expect(result).not.toContain('super-secret');
  });

  it('should say when DATABASE_URL is missing', () => {
    expect(describeDatabaseUrl(undefined)).toBe('(DATABASE_URL is not set)');
  });

  it('should not print an invalid URL as-is', () => {
    expect(describeDatabaseUrl('not a url with password')).toBe('(DATABASE_URL is not a valid URL)');
  });
});
