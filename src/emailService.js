const ProviderA = require('./providers/providerA');
const ProviderB = require('./providers/providerB');
const RateLimiter = require('./utils/rateLimiter');
const CircuitBreaker = require('./utils/circuitBreaker');
const InMemoryQueue = require('./utils/queue');
const logger = require('./utils/logger');
const config = require('./config');

class EmailService {
  constructor() {
    this.providers = [new ProviderA(), new ProviderB()];
    
    this.idempotencyStore = new Map();
    this.statusStore = new Map();

    this.rateLimiter = new RateLimiter(config.RATE_LIMIT_MAX_REQUESTS, config.RATE_LIMIT_INTERVAL_MS);
    this.emailQueue = new InMemoryQueue();
    
    this.circuitBreakers = this.providers.map(() => new CircuitBreaker(
      config.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      config.CIRCUIT_BREAKER_RESET_TIMEOUT_MS
    ));

    setInterval(() => this._processQueue(), config.QUEUE_PROCESS_INTERVAL_MS);
  }

 
  async sendEmail(emailDetails) {
    const { idempotencyKey } = emailDetails;

if (this.idempotencyStore.has(idempotencyKey)) {
  logger.warn(`Duplicate request detected for key: ${idempotencyKey}`);
  const status = this.idempotencyStore.get(idempotencyKey); 
  return { status: 'duplicate', message: 'Email with this key already processed.', originalStatus: status };
}

 
    if (!this.rateLimiter.isAllowed()) {
      logger.warn('Rate limit exceeded. Queuing email.');
      this.emailQueue.enqueue(emailDetails);
      this.idempotencyStore.set(idempotencyKey, 'queued');
      this.statusStore.set(idempotencyKey, 'queued');
      return { status: 'rate_limited', message: 'Email has been queued and will be sent later.' };
    }

    this.idempotencyStore.set(idempotencyKey, 'processing');
    this.statusStore.set(idempotencyKey, 'processing');

    return this._trySendWithProviders(emailDetails);
  }

  /**
   * Tries to send an email using the available providers, with retry and fallback logic.
   * @private
   */
  async _trySendWithProviders(emailDetails, providerIndex = 0) {
    if (providerIndex >= this.providers.length) {
      logger.error(`All providers failed for key: ${emailDetails.idempotencyKey}`);
      this._updateFinalStatus(emailDetails.idempotencyKey, 'failed', { error: 'All providers are unavailable.' });
      return { status: 'failed', message: 'All providers failed to send the email.' };
    }

    const provider = this.providers[providerIndex];
    const circuitBreaker = this.circuitBreakers[providerIndex];

    if (!circuitBreaker.isRequestAllowed()) {
      logger.warn(`Circuit for ${provider.name} is OPEN. Falling back immediately.`);
      return this._trySendWithProviders(emailDetails, providerIndex + 1);
    }
    
    try {
      const result = await this._retryWithBackoff(provider, emailDetails, circuitBreaker);
      logger.info(`Successfully sent email with ${provider.name} for key: ${emailDetails.idempotencyKey}`);
      circuitBreaker.recordSuccess();
      this._updateFinalStatus(emailDetails.idempotencyKey, 'success', { provider: provider.name });
      return { status: 'success', provider: provider.name };
    } catch (error) {
      logger.warn(`Provider ${provider.name} failed permanently after retries. Error: ${error.message}`);
      return this._trySendWithProviders(emailDetails, providerIndex + 1);
    }
  }


   

  /**
   * Handles the retry logic for a single provider with exponential backoff.
   * This version uses a modern async/await loop which is cleaner and works
   * more reliably with Jest's fake timers.
   * @private
   */
  async _retryWithBackoff(provider, emailDetails, circuitBreaker) {
    let lastError = null;
    
    for (let attempt = 0; attempt <= config.MAX_RETRIES; attempt++) {
      try {
        const result = await provider.send(emailDetails);
        return result; 
      } catch (error) {
        lastError = error;
        circuitBreaker.recordFailure();
        const retriesLeft = config.MAX_RETRIES - attempt;
        logger.warn(`Attempt failed for ${provider.name} (${retriesLeft} retries left). Error: ${error.message}`);

        if (retriesLeft > 0) {
          const delay = config.INITIAL_BACKOFF_MS * (2 ** attempt);
          logger.info(`Retrying with ${provider.name} in ${delay}ms...`);
  
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

   
    throw new Error(`Provider ${provider.name} failed after ${config.MAX_RETRIES} retries. Last error: ${lastError.message}`);
  }



  /**
   * Processes emails from the queue.
   * @private
   */
  _processQueue() {
    if (this.emailQueue.isEmpty()) {
      return;
    }

    logger.info(`Processing queue. Current size: ${this.emailQueue.size()}`);
    while (!this.emailQueue.isEmpty() && this.rateLimiter.isAllowed()) {
      const emailDetails = this.emailQueue.dequeue();
      if (emailDetails) {
        logger.info(`Sending queued email for key: ${emailDetails.idempotencyKey}`);
        this._trySendWithProviders(emailDetails);
      }
    }
  }

  /**
   * Updates the final status of an email send operation.
   * @private
   */
  _updateFinalStatus(idempotencyKey, status, details) {
    this.idempotencyStore.set(idempotencyKey, status);
    this.statusStore.set(idempotencyKey, { status, ...details, timestamp: new Date().toISOString() });
  }

  getStatus(idempotencyKey) {
    return this.statusStore.get(idempotencyKey);
  }
}

module.exports = EmailService;