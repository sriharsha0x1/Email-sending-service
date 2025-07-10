// Mock Provider B
const config = require('../config');
const logger = require('../utils/logger');

class ProviderB {
  constructor() {
    this.name = 'ProviderB';
  }

  /**
   * Simulates sending an email, with a random chance of failure.
   * @param {object} emailDetails - { to, subject, body, idempotencyKey }
   * @returns {Promise<object>}
   */
  send(emailDetails) {
    return new Promise((resolve, reject) => {
      logger.info(`[${this.name}] Attempting to send email to ${emailDetails.to}`);
      
      setTimeout(() => {
        if (Math.random() > config.PROVIDER_B_FAILURE_RATE) {
          logger.info(`[${this.name}] Successfully sent email to ${emailDetails.to}`);
          resolve({ success: true, provider: this.name });
        } else {
          logger.warn(`[${this.name}] FAILED to send email to ${emailDetails.to}`);
          reject(new Error('Simulated failure from ProviderB'));
        }
      }, 70 + Math.random() * 80); 
    });
  }
}

module.exports = ProviderB;