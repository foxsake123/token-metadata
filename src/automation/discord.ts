/**
 * Discord Webhook Integration for $LIST Token
 *
 * Sends notifications to Discord for:
 * - Burn detections and executions
 * - Polymarket confirmations
 * - Server status updates
 */

import https from 'https';
import { URL } from 'url';

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

// Discord embed colors
export const DISCORD_COLORS = {
  burn: 0xff6b35,      // Orange - burns
  success: 0x4ade80,   // Green - success
  warning: 0xfbbf24,   // Yellow - warnings
  info: 0x3b82f6,      // Blue - info
  error: 0xef4444,     // Red - errors
};

export class DiscordWebhook {
  private webhookUrl: string | null;
  private username: string;
  private avatarUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || null;
    this.username = '$LIST Bot';
    this.avatarUrl = 'https://list-coin.com/logo.png';
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }

  async send(message: DiscordMessage): Promise<boolean> {
    if (!this.webhookUrl) {
      console.log('📢 [Discord - Not Configured]', message.content || message.embeds?.[0]?.title);
      return false;
    }

    try {
      const payload = JSON.stringify({
        ...message,
        username: this.username,
        avatar_url: this.avatarUrl,
      });

      const url = new URL(this.webhookUrl);

      return new Promise((resolve) => {
        const req = https.request(
          {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            if (res.statusCode === 204 || res.statusCode === 200) {
              resolve(true);
            } else {
              console.error(`❌ Discord webhook failed: ${res.statusCode}`);
              resolve(false);
            }
          }
        );

        req.on('error', (error) => {
          console.error(`❌ Discord webhook error: ${error.message}`);
          resolve(false);
        });

        req.write(payload);
        req.end();
      });
    } catch (error) {
      console.error('❌ Discord send error:', error);
      return false;
    }
  }

  // Convenience methods for common notifications

  async sendBurnDetected(name: string, percent: number): Promise<boolean> {
    return this.send({
      embeds: [{
        title: '🔥 BURN INCOMING',
        description: `**${name}** has been CONFIRMED on the Epstein list!`,
        color: DISCORD_COLORS.burn,
        fields: [
          { name: 'Burn Amount', value: `${percent}%`, inline: true },
          { name: 'Status', value: 'Pending Execution', inline: true },
        ],
        footer: { text: 'The more names drop. The more $LIST pops.' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  async sendBurnExecuted(name: string, percent: number, txSignature: string): Promise<boolean> {
    return this.send({
      embeds: [{
        title: '✅ BURN EXECUTED',
        description: `**${name}**: ${percent}% of supply BURNED FOREVER`,
        color: DISCORD_COLORS.success,
        fields: [
          { name: 'Transaction', value: `[View on Solscan](https://solscan.io/tx/${txSignature})`, inline: false },
        ],
        footer: { text: 'Supply reduced. Value increased.' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  async sendBurnPendingApproval(name: string, percent: number): Promise<boolean> {
    return this.send({
      embeds: [{
        title: '🔔 BURN PENDING APPROVAL',
        description: `**${name}** confirmed - awaiting manual approval`,
        color: DISCORD_COLORS.warning,
        fields: [
          { name: 'Burn Amount', value: `${percent}%`, inline: true },
          { name: 'Action Required', value: 'Admin must approve', inline: true },
        ],
        footer: { text: 'Use /approvals endpoint to view pending burns' },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  async sendServerStatus(status: 'online' | 'offline', details?: string): Promise<boolean> {
    return this.send({
      embeds: [{
        title: status === 'online' ? '🟢 Server Online' : '🔴 Server Offline',
        description: details || `$LIST automation server is ${status}`,
        color: status === 'online' ? DISCORD_COLORS.success : DISCORD_COLORS.error,
        timestamp: new Date().toISOString(),
      }],
    });
  }

  async sendOddsUpdate(topNames: Array<{ name: string; odds: number }>): Promise<boolean> {
    const fields = topNames.slice(0, 5).map((t, i) => ({
      name: `#${i + 1} ${t.name}`,
      value: `${t.odds}% chance`,
      inline: true,
    }));

    return this.send({
      embeds: [{
        title: '📊 Polymarket Odds Update',
        description: 'Current top burn candidates:',
        color: DISCORD_COLORS.info,
        fields,
        footer: { text: 'If confirmed = BURN 🔥' },
        timestamp: new Date().toISOString(),
      }],
    });
  }
}

// Singleton instance
let discordClient: DiscordWebhook | null = null;

export function getDiscordClient(): DiscordWebhook {
  if (!discordClient) {
    discordClient = new DiscordWebhook();
  }
  return discordClient;
}
