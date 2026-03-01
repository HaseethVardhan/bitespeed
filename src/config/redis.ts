import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create a Redis instance with retry strategy and error handling
const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    // retry strategy to avoid infinite loops if Redis is permanently down
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    // Don't connect immediately, wait for explicit connectRedis call
    lazyConnect: true,
    // TLS is required for most hosted Redis providers like Redis Cloud
    // It's ignored if the URL doesn't use rediss:// but good to provide the object
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined
});

// Event listeners for logging and monitoring
redis.on('error', (err: any) => {
    // Only log actual connection errors, not expected retry warnings
    if (err.code !== 'ECONNREFUSED') {
        console.error('Redis Error:', err);
    }
});

export const connectRedis = async (): Promise<void> => {
    try {
        await redis.connect();
        console.log('Redis connected successfully');
    } catch (error) {
        console.error('Failed to connect to Redis. Caching will be disabled.');
        // We don't throw here to allow graceful degradation (app still runs, just without cache)
    }
};

export const disconnectRedis = async (): Promise<void> => {
    try {
        await redis.quit();
        console.log('Redis disconnected gracefully');
    } catch (error) {
        console.error('Error disconnecting Redis:', error);
    }
};

export { redis };
