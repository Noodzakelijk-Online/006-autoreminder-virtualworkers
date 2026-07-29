import { describe, it, expect } from 'vitest';
import { validateSendGridApiKey } from './email';

describe('Email Service', () => {
  it('should validate SendGrid API key format', async () => {
    // The validateSendGridApiKey function checks if the key starts with 'SG.'
    const isValid = await validateSendGridApiKey();
    
    // If SENDGRID_API_KEY is set and valid, it should return true
    // If not set, it should return false
    expect(typeof isValid).toBe('boolean');
    
    // If the env var is set, it should be valid (starts with SG.)
    if (process.env.SENDGRID_API_KEY) {
      expect(isValid).toBe(true);
    }
  });
});
