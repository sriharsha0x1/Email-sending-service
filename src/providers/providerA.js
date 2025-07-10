// Mock Provider A
const config = require('../config');
const logger = require('../utils/logger');

class ProviderA {
  constructor() {
    this.name = 'ProviderA';
  }

  /**
   * Simulates sending an email, with a random chance of failure.
   * @param {object} emailDetails - { to, subject, body, idempotencyKey }
   * @returns {Promise<object>}
   */
  send(emailDetails) {
    return new Promise((resolve, reject) => {
      logger.info(`[${this.name}] Attempting to send email to ${emailDetails.to}`);
      // Simulate network delay
      setTimeout(() => {
        if (Math.random() > config.PROVIDER_A_FAILURE_RATE) {
          logger.info(`[${this.name}] Successfully sent email to ${emailDetails.to}`);
          resolve({ success: true, provider: this.name });
        } else {
          logger.warn(`[${this.name}] FAILED to send email to ${emailDetails.to}`);
          reject(new Error('Simulated failure from ProviderA'));
        }
      }, 50 + Math.random() * 50);
    });
  }
}

module.exports = ProviderA;