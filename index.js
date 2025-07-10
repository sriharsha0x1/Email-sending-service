const { v4: uuidv4 } = require('uuid');
const EmailService = require('./src/emailService');
const logger = require('./src/utils/logger');

const emailService = new EmailService();

async function sendAndLog(email, idempotencyKey = null) {
  const key = idempotencyKey || uuidv4();
  logger.info(`--> Sending email to ${email.to} with key: ${key}`);
  const result = await emailService.sendEmail({ ...email, idempotencyKey: key });
  logger.info(`<-- Final status for key ${key}: ${JSON.stringify(result)}\n`);
  return result;
}

async function main() {
  logger.info('--- Starting Email Service Demonstration ---');

  const sampleEmail = {
    to: 'recipient@example.com',
    subject: 'Your Daily Update',
    body: 'Hello, this is your daily update.',
  };

  logger.info('--- 1. DEMO: Successful Send ---');
  await sendAndLog({ ...sampleEmail, to: 'success@example.com' });

  logger.info('--- 2. DEMO: Idempotency Check ---');
  const idempotentKey = 'idempotent-test-key-123';
  await sendAndLog({ ...sampleEmail, to: 'idempotent1@example.com' }, idempotentKey);
  await sendAndLog({ ...sampleEmail, to: 'idempotent2@example.com' }, idempotentKey);

  logger.info('--- 3. DEMO: Rate Limiting and Queueing ---');
  const promises = [];
  for (let i = 1; i <= 15; i++) {
    const email = { ...sampleEmail, to: `user${i}@ratelimit.com`, subject: `Email ${i}` };
    promises.push(sendAndLog(email));
  }
  await Promise.allSettled(promises);

  logger.info('--- Waiting for queue to process... (check logs over the next minute) ---');

  setTimeout(() => {
    logger.info('--- Demonstration Finished ---');
    process.exit(0);
  }, 70000);
}

main().catch(error => {
  logger.error('An unexpected error occurred during the demonstration:', error);
  process.exit(1);
});
