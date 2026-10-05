import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('should not store the password in plain text', async () => {
    const hash = await hashPassword('supersecret123');

    expect(hash).not.toContain('supersecret123');
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('should produce a different hash each time for the same password', async () => {
    const first = await hashPassword('supersecret123');
    const second = await hashPassword('supersecret123');

    expect(first).not.toEqual(second);
  });

  it('should verify the correct password', async () => {
    const hash = await hashPassword('supersecret123');

    await expect(verifyPassword('supersecret123', hash)).resolves.toBe(true);
  });

  it('should reject a wrong password', async () => {
    const hash = await hashPassword('supersecret123');

    await expect(verifyPassword('wrongpassword', hash)).resolves.toBe(false);
  });

  it.each([
    ['empty', ''],
    ['missing separator', 'abcdef'],
    ['missing hash', 'abcdef:'],
    ['hash of the wrong length', 'abcdef:1234'],
  ])('should reject a malformed stored hash (%s)', async (_label, stored) => {
    await expect(verifyPassword('supersecret123', stored)).resolves.toBe(false);
  });
});
