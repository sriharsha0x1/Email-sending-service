# Resilient Email Sending Service

This project implements a resilient email sending service in Node.js. It's designed to handle provider failures gracefully by incorporating features like automatic retries, fallback to a secondary provider, rate limiting, and circuit breakers.

## ✨ Features

- **Retry Logic**: Automatically retries sending an email with exponential backoff if a provider fails.
- **Fallback Mechanism**: Switches to a secondary provider if the primary provider fails all retry attempts.
- **Idempotency**: Prevents duplicate email sends for the same operation using a unique key.
- **Rate Limiting**: Throttles the number of outgoing emails to avoid overwhelming providers.
- **In-Memory Queue**: Buffers emails that exceed the rate limit and processes them later.
- **Circuit Breaker**: Temporarily stops sending requests to a provider that is consistently failing.
- **Status Tracking**: Monitors the final status of each email send request (`success`, `failed`, `duplicate`, `rate_limited`).
- **Console Logging**: Provides timestamped logs for all major events.

## 📂 Project Structure

/resilient-email-service
├── src/
│ ├── emailService.js # The core EmailService class
│ ├── providers/
│ │ ├── providerA.js # Mock Provider A
│ │ └── providerB.js # Mock Provider B
│ ├── utils/
│ │ ├── circuitBreaker.js # Circuit Breaker implementation
│ │ ├── logger.js # Simple logging utility
│ │ ├── queue.js # In-memory queue
│ │ └── rateLimiter.js # Rate Limiter implementation
│ └── config.js # Configuration constants
├── tests/
│ └── emailService.test.js # Unit tests
├── index.js # Demo entry point
├── package.json # Dependencies and scripts
└── README.md # This file
