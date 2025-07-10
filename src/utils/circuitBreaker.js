// Circuit Breaker implementation
const logger = require('./logger');

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  /**
   * @param {number} failureThreshold - The number of failures to open the circuit.
   * @param {number} resetTimeout 
   */
  constructor(failureThreshold, resetTimeout) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.resetTimer = null;
  }

  isRequestAllowed() {
    return this.state !== STATE.OPEN;
  }

  recordSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      this._reset();
      logger.info('Circuit Breaker has been reset to CLOSED state after a successful call.');
    }
    this.failureCount = 0;
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATE.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this._trip();
    }
  }

  _trip() {
    if (this.state === STATE.OPEN) return; // Already open, do nothing.

    this.state = STATE.OPEN;
    logger.error(`Circuit Breaker tripped! State is now OPEN. It will enter HALF_OPEN after ${this.resetTimeout / 1000}s.`);
    
    this.resetTimer = setTimeout(() => {
      this.state = STATE.HALF_OPEN;
      logger.warn('Circuit Breaker state is now HALF_OPEN. It will allow one test request.');
    }, this.resetTimeout);
  }

  _reset() {
    clearTimeout(this.resetTimer);
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

module.exports = CircuitBreaker;