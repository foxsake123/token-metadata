/**
 * Twitter API Integration for $LIST Token
 *
 * Handles automated tweet posting for burn events.
 * Uses Twitter API v2 with OAuth 1.0a authentication.
 */

import crypto from 'crypto';
import https from 'https';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

interface TweetResponse {
  success: boolean;
  tweetId?: string;
  error?: string;
}

// =============================================================================
// OAUTH 1.0a SIGNATURE
// =============================================================================

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function generateSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  config: TwitterConfig
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessSecret)}`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  return signature;
}

function generateAuthHeader(
  method: string,
  url: string,
  config: TwitterConfig,
  extraParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  // Combine oauth params with extra params for signature
  const allParams = { ...oauthParams, ...extraParams };
  const signature = generateSignature(method, url, allParams, config);
  oauthParams['oauth_signature'] = signature;

  // Build authorization header
  const authHeader = Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${authHeader}`;
}

// =============================================================================
// TWITTER CLIENT
// =============================================================================

export class TwitterClient {
  private config: TwitterConfig;
  private dryRun: boolean;

  constructor(config?: Partial<TwitterConfig>, dryRun = false) {
    this.config = {
      apiKey: config?.apiKey || process.env.TWITTER_API_KEY || '',
      apiSecret: config?.apiSecret || process.env.TWITTER_API_SECRET || '',
      accessToken: config?.accessToken || process.env.TWITTER_ACCESS_TOKEN || '',
      accessSecret: config?.accessSecret || process.env.TWITTER_ACCESS_SECRET || '',
    };
    this.dryRun = dryRun;
  }

  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.apiSecret &&
      this.config.accessToken &&
      this.config.accessSecret
    );
  }

  async postTweet(text: string): Promise<TweetResponse> {
    if (this.dryRun) {
      console.log('🐦 [DRY RUN] Would tweet:');
      console.log('─'.repeat(50));
      console.log(text);
      console.log('─'.repeat(50));
      return { success: true, tweetId: 'dry-run-id' };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Twitter API not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET',
      };
    }

    const url = 'https://api.twitter.com/2/tweets';
    const body = JSON.stringify({ text });

    try {
      const authHeader = generateAuthHeader('POST', url, this.config);

      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.data?.id) {
        console.log(`✅ Tweet posted: https://twitter.com/i/status/${response.data.id}`);
        return { success: true, tweetId: response.data.id };
      } else {
        return { success: false, error: response.error || 'Unknown error' };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Tweet failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  async postThread(tweets: string[]): Promise<TweetResponse[]> {
    const results: TweetResponse[] = [];
    let replyToId: string | undefined;

    for (const text of tweets) {
      if (this.dryRun) {
        console.log('🐦 [DRY RUN] Thread tweet:');
        console.log('─'.repeat(50));
        console.log(text);
        console.log('─'.repeat(50));
        results.push({ success: true, tweetId: `dry-run-${results.length}` });
        continue;
      }

      const url = 'https://api.twitter.com/2/tweets';
      const body: Record<string, unknown> = { text };

      if (replyToId) {
        body.reply = { in_reply_to_tweet_id: replyToId };
      }

      try {
        const authHeader = generateAuthHeader('POST', url, this.config);

        const response = await this.makeRequest(url, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.data?.id) {
          replyToId = response.data.id;
          results.push({ success: true, tweetId: response.data.id });
        } else {
          results.push({ success: false, error: response.error || 'Unknown error' });
          break; // Stop thread on error
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ success: false, error: errorMsg });
        break;
      }

      // Rate limit: 200ms between tweets
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  private makeRequest(
    url: string,
    options: { method: string; headers: Record<string, string>; body?: string }
  ): Promise<{ data?: { id: string }; error?: string }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);

      const req = https.request(
        {
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          method: options.method,
          headers: options.headers,
        },
        res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsed);
              } else {
                resolve({
                  error: parsed.detail || parsed.title || `HTTP ${res.statusCode}`,
                });
              }
            } catch {
              resolve({ error: `Failed to parse response: ${data}` });
            }
          });
        }
      );

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let defaultClient: TwitterClient | null = null;

export function getTwitterClient(dryRun = false): TwitterClient {
  if (!defaultClient) {
    defaultClient = new TwitterClient(undefined, dryRun);
  }
  return defaultClient;
}

export async function tweet(text: string): Promise<TweetResponse> {
  const client = getTwitterClient();
  return client.postTweet(text);
}

export async function tweetThread(tweets: string[]): Promise<TweetResponse[]> {
  const client = getTwitterClient();
  return client.postThread(tweets);
}

// =============================================================================
// CLI USAGE
// =============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npx ts-node src/automation/twitter.ts "Your tweet text"');
    console.log('  npx ts-node src/automation/twitter.ts --test');
    process.exit(1);
  }

  if (args[0] === '--test') {
    const client = new TwitterClient(undefined, true);
    client.postTweet('🔥 Test tweet from $LIST automation!');
  } else {
    const client = new TwitterClient();
    if (!client.isConfigured()) {
      console.error('❌ Twitter API not configured');
      console.log('Set environment variables:');
      console.log('  TWITTER_API_KEY');
      console.log('  TWITTER_API_SECRET');
      console.log('  TWITTER_ACCESS_TOKEN');
      console.log('  TWITTER_ACCESS_SECRET');
      process.exit(1);
    }
    client.postTweet(args.join(' ')).then(result => {
      if (!result.success) {
        console.error(`Failed: ${result.error}`);
        process.exit(1);
      }
    });
  }
}
