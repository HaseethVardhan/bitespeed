import { redis } from '../config/redis';
import { IdentifyResponse } from './contact.service';

const CACHE_TTL = process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : 3600;

export const isRedisAvailable = (): boolean => {
    return redis.status === 'ready';
};

/**
 * Gets the cached response for a specific email+phone combination
 */
export const getCachedResponse = async (email?: string, phoneNumber?: string): Promise<IdentifyResponse | null> => {
    if (!isRedisAvailable()) return null;

    try {
        const cacheKey = `identify:${email || 'none'}:${phoneNumber || 'none'}`;
        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return JSON.parse(cachedData) as IdentifyResponse;
        }
    } catch (error) {
        console.error('Error reading from cache:', error);
    }

    return null;
};

/**
 * Stores the response in cache and adds the key to the cluster's set for easy invalidation
 */
export const setCachedResponse = async (
    email: string | undefined,
    phoneNumber: string | undefined,
    response: IdentifyResponse,
    primaryContactId: number
): Promise<void> => {
    if (!isRedisAvailable()) return;

    try {
        const cacheKey = `identify:${email || 'none'}:${phoneNumber || 'none'}`;
        const clusterSetKey = `cluster:${primaryContactId}`;

        // Use a pipeline to execute both commands atomically
        const pipeline = redis.pipeline();

        // 1. Store the JSON response with the TTL
        pipeline.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

        // 2. Add the input key to the cluster's set (so we know what to invalidate later)
        pipeline.sadd(clusterSetKey, cacheKey);

        // 3. Set the TTL on the cluster set as well, just to ensure it cleans up eventually
        pipeline.expire(clusterSetKey, CACHE_TTL);

        await pipeline.exec();
    } catch (error) {
        console.error('Error writing to cache:', error);
    }
};

/**
 * Invalidates all cached responses associated with a specific contact cluster
 */
export const invalidateCluster = async (primaryContactId: number): Promise<void> => {
    if (!isRedisAvailable()) return;

    try {
        const clusterSetKey = `cluster:${primaryContactId}`;

        // Find all input keys associated with this cluster
        const inputKeys = await redis.smembers(clusterSetKey);

        if (inputKeys.length > 0) {
            // Delete all input keys AND the set itself in one pipeline
            const pipeline = redis.pipeline();
            pipeline.del(...inputKeys, clusterSetKey);
            await pipeline.exec();

            console.log(`Cache invalidated for cluster ${primaryContactId} (${inputKeys.length} entries)`);
        }
    } catch (error) {
        console.error(`Error invalidating cache for cluster ${primaryContactId}:`, error);
    }
};
