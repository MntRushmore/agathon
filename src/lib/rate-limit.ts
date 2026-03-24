import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Falls back to no-op if Upstash is not configured (dev environment)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export type RateLimitTier = 'chat' | 'image' | 'voice' | 'tts' | 'default';

const limits: Record<RateLimitTier, { requests: number; window: string }> = {
  chat: { requests: 60, window: '1m' },
  image: { requests: 10, window: '1m' },
  voice: { requests: 5, window: '1m' },
  tts: { requests: 20, window: '1m' },
  default: { requests: 30, window: '1m' },
};

const limiters = new Map<RateLimitTier, Ratelimit>();

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  if (!redis) return null;
  if (!limiters.has(tier)) {
    const config = limits[tier];
    limiters.set(
      tier,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window as `${number} s` | `${number} m` | `${number} h` | `${number} d`),
        prefix: `ratelimit:${tier}`,
      })
    );
  }
  return limiters.get(tier)!;
}

export async function checkRateLimit(
  userId: string,
  tier: RateLimitTier = 'default'
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limiter = getLimiter(tier);
  if (!limiter) return { success: true, remaining: -1, reset: 0 };
  try {
    const result = await limiter.limit(userId);
    return { success: result.success, remaining: result.remaining, reset: result.reset };
  } catch (error) {
    console.error('Rate limit check failed, allowing request:', error);
    return { success: true, remaining: -1, reset: 0 };
  }
}
