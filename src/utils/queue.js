// In-memory queue
class InMemoryQueue {
  constructor() {
    this.items = [];
  }

  /**
   * Adds an item to the end of the queue.
   * @param {*} item
   */
  enqueue(item) {
    this.items.push(item);
  }

  /**
   * Removes and returns the item at the front of the queue.
   * @returns {*} The dequeued item or undefined if the queue is empty.
   */
  dequeue() {
    return this.items.shift();
  }

  /**
   * @returns {boolean} True if the queue is empty.
   */
  isEmpty() {
    return this.items.length === 0;
  }

  /**
   * @returns {number} The number of items in the queue.
   */
  size() {
    return this.items.length;
  }
}

module.exports = InMemoryQueue;