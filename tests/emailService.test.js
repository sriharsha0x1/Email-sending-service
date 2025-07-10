
jest.mock('../src/providers/providerA');
jest.mock('../src/providers/providerB');

jest.mock('../src/config', () => ({
  ...jest.requireActual('../src/config'),
  QUEUE_PROCESS_INTERVAL_MS: 1000 * 60 * 60,
}));

const EmailService = require('../src/emailService');
const ProviderA = require('../src/providers/providerA');
const ProviderB = require('../src/providers/providerB');
const config = require('../src/config');


const mockProviderASend = jest.fn();
const mockProviderBSend = jest.fn();

describe('EmailService', () => {
  let emailService;
  let mockEmail;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
  
    jest.clearAllMocks();

 
    ProviderA.mockImplementation(() => {
      return {
        name: 'ProviderA',
        send: mockProviderASend,
      };
    });


    ProviderB.mockImplementation(() => {
      return {
        name: 'ProviderB',
        send: mockProviderBSend,
      };
    });

    emailService = new EmailService();
    mockEmail = { to: 'test@example.com', subject: 'Test', body: 'This is a test', idempotencyKey: 'test-key-1' };
  });
  
  afterAll(() => {
    jest.useRealTimers();
  });

  test('should send an email successfully with the primary provider on the first try', async () => {
    mockProviderASend.mockResolvedValue({ success: true, provider: 'ProviderA' });

    const result = await emailService.sendEmail(mockEmail);

    expect(result.status).toBe('success');
    expect(result.provider).toBe('ProviderA');
    expect(mockProviderASend).toHaveBeenCalledTimes(1);
    expect(mockProviderBSend).not.toHaveBeenCalled();
  });

  test('should retry with the primary provider and succeed', async () => {
    mockProviderASend
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockResolvedValue({ success: true, provider: 'ProviderA' });
      
    const promise = emailService.sendEmail(mockEmail);
   
    await jest.advanceTimersByTimeAsync(config.INITIAL_BACKOFF_MS);

    const result = await promise;

    expect(result.status).toBe('success');
    expect(mockProviderASend).toHaveBeenCalledTimes(2);
  });

  test('should fallback to the secondary provider if the primary fails all retries', async () => {
    mockProviderASend.mockRejectedValue(new Error('Primary provider failed'));
    mockProviderBSend.mockResolvedValue({ success: true, provider: 'ProviderB' });
    
    const promise = emailService.sendEmail(mockEmail);

    await jest.runAllTimersAsync();
    
    const result = await promise;

    expect(result.status).toBe('success');
    expect(result.provider).toBe('ProviderB');
    expect(mockProviderASend).toHaveBeenCalledTimes(config.MAX_RETRIES + 1);
    expect(mockProviderBSend).toHaveBeenCalledTimes(1);
  });

  test('should fail if all providers fail', async () => {
    mockProviderASend.mockRejectedValue(new Error('ProviderA failed'));
    mockProviderBSend.mockRejectedValue(new Error('ProviderB failed'));
    
    const promise = emailService.sendEmail(mockEmail);

   
    await jest.runAllTimersAsync();
    
    const result = await promise;

    expect(result.status).toBe('failed');
    expect(mockProviderASend).toHaveBeenCalledTimes(config.MAX_RETRIES + 1);
    expect(mockProviderBSend).toHaveBeenCalledTimes(config.MAX_RETRIES + 1);
  });

  test('should return a duplicate status for a repeated idempotency key', async () => {
    mockProviderASend.mockResolvedValue({ success: true, provider: 'ProviderA' });

    await emailService.sendEmail(mockEmail);
 
    const result = await emailService.sendEmail(mockEmail);

    expect(result.status).toBe('duplicate');
    expect(result.originalStatus.status).toBe('success'); 
    expect(mockProviderASend).toHaveBeenCalledTimes(1); 
  });
  
  test('should return rate_limited and queue email if limit is exceeded', async () => {
    
    emailService.rateLimiter.limit = 1;

    // First request should be fine
    mockProviderASend.mockResolvedValue({ success: true });
    await emailService.sendEmail({ ...mockEmail, idempotencyKey: 'rate-key-1' });

    const result = await emailService.sendEmail({ ...mockEmail, idempotencyKey: 'rate-key-2' });

    expect(result.status).toBe('rate_limited');
    expect(emailService.emailQueue.size()).toBe(1);
  });
  
  test('should immediately fallback if circuit breaker is open', async () => {
    mockProviderBSend.mockResolvedValue({ success: true, provider: 'ProviderB' });
    
    const circuitBreakerA = emailService.circuitBreakers[0];
    
    for (let i = 0; i < config.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        circuitBreakerA.recordFailure();
    }
    expect(circuitBreakerA.isRequestAllowed()).toBe(false);

    const result = await emailService.sendEmail(mockEmail);

    expect(mockProviderASend).not.toHaveBeenCalled();
    expect(mockProviderBSend).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('success');
  });
});