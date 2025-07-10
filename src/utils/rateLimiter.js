
class RateLimiter {
  /**
   * @param {number} limit 
   */
  constructor(limit, interval) {
    this.limit = limit;
    this.interval = interval;
    this.requestTimestamps = [];
  }

  /**
   * Checks if a new request is allowed.
   * @returns {boolean} - True if the request is allowed, false otherwise.
   */
  isAllowed() {
    const now = Date.now();

    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.interval
    );
    
    if (this.requestTimestamps.length < this.limit) {
      this.requestTimestamps.push(now);
      return true;
    }
    
    return false;
  }
}

module.exports = RateLimiter;