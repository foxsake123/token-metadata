/**
 * LIST Token Burn Scheduler
 *
 * Automated monitoring and execution of burns based on:
 * - Polymarket resolution events
 * - Community milestones
 * - Manual triggers
 */

import {
  BurnTarget,
  EPSTEIN_RESOLVED_BURNS,
  EPSTEIN_ACTIVE_BURNS,
  EPSTEIN_MILESTONES,
  DIDDY_SENTENCE_BURNS,
  DIDDY_BONUS_BURNS,
  getOwedBurns,
  calculateBurnAmount,
  formatBurnAmount,
} from '../burn/config';
import { checkConfirmedPredictions } from '../burn/polymarket';

export interface ScheduledBurn {
  target: BurnTarget;
  scheduledFor: Date;
  executed: boolean;
  txSignature?: string;
}

export interface MilestoneCheck {
  slug: string;
  checkFn: () => Promise<boolean>;
  lastChecked?: Date;
}

export class BurnScheduler {
  private scheduledBurns: ScheduledBurn[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  public onBurnDetected?: (target: BurnTarget) => Promise<void>;
  public onBurnExecuted?: (target: BurnTarget, signature: string) => Promise<void>;

  constructor(
    private rpcUrl: string,
    private _burnAuthoritySecret?: Uint8Array
  ) {}

  /**
   * Start the automated scheduler
   */
  start(intervalMs: number = 60000) {
    console.log('🔥 Starting LIST burn scheduler...');

    // Check for owed burns immediately
    this.checkOwedBurns();

    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.runScheduledChecks();
    }, intervalMs);

    console.log(`⏰ Scheduler running every ${intervalMs / 1000}s`);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('🛑 Scheduler stopped');
  }

  /**
   * Check for burns that are owed (already confirmed but not executed)
   */
  async checkOwedBurns(): Promise<ScheduledBurn[]> {
    const owedBurns = getOwedBurns();
    const scheduled: ScheduledBurn[] = [];

    for (const target of owedBurns) {
      if (!this.isAlreadyScheduled(target.slug)) {
        const burn: ScheduledBurn = {
          target,
          scheduledFor: new Date(), // Execute immediately
          executed: false,
        };
        this.scheduledBurns.push(burn);
        scheduled.push(burn);

        console.log(`📋 Scheduled owed burn: ${target.name} (${target.burnAllocationPercent}%)`);
        await this.onBurnDetected?.(target);
      }
    }

    return scheduled;
  }

  /**
   * Check Polymarket for newly resolved predictions
   */
  async checkPolymarketResolutions(): Promise<string[]> {
    const confirmed = await checkConfirmedPredictions();
    const newlyConfirmed: string[] = [];

    for (const name of confirmed) {
      const target = [...EPSTEIN_ACTIVE_BURNS, ...DIDDY_SENTENCE_BURNS, ...DIDDY_BONUS_BURNS]
        .find((t: BurnTarget) => t.name.toLowerCase() === name.toLowerCase() && t.status === 'pending');

      if (target && !this.isAlreadyScheduled(target.slug)) {
        target.status = 'confirmed';
        const burn: ScheduledBurn = {
          target,
          scheduledFor: new Date(),
          executed: false,
        };
        this.scheduledBurns.push(burn);
        newlyConfirmed.push(name);

        console.log(`🆕 New confirmation: ${name} - scheduling burn`);
        await this.onBurnDetected?.(target);
      }
    }

    return newlyConfirmed;
  }

  /**
   * Run all scheduled checks
   */
  async runScheduledChecks() {
    console.log(`\n⏰ [${new Date().toISOString()}] Running scheduled checks...`);

    // Check Polymarket
    const newConfirmations = await this.checkPolymarketResolutions();
    if (newConfirmations.length > 0) {
      console.log(`📢 ${newConfirmations.length} new confirmations found!`);
    }

    // Execute pending burns
    await this.executePendingBurns();
  }

  /**
   * Execute all pending scheduled burns
   */
  async executePendingBurns(): Promise<ScheduledBurn[]> {
    const pendingBurns = this.scheduledBurns.filter(
      b => !b.executed && b.scheduledFor <= new Date()
    );

    const executed: ScheduledBurn[] = [];

    for (const burn of pendingBurns) {
      try {
        console.log(`🔥 Executing burn: ${burn.target.name}`);

        // In production, this would call the actual burn executor
        // For now, simulate the burn
        const burnAmount = calculateBurnAmount(burn.target);
        console.log(`   Amount: ${formatBurnAmount(burnAmount)} LIST`);

        // Mark as executed (in production, would include actual tx)
        burn.executed = true;
        burn.txSignature = `simulated_${Date.now()}_${burn.target.slug}`;
        burn.target.status = 'executed';

        executed.push(burn);
        await this.onBurnExecuted?.(burn.target, burn.txSignature!);

        console.log(`✅ Burn executed: ${burn.target.name}`);
      } catch (error) {
        console.error(`❌ Burn failed for ${burn.target.name}:`, error);
      }
    }

    return executed;
  }

  /**
   * Get summary of all burns
   */
  getSummary(): {
    owed: BurnTarget[];
    scheduled: ScheduledBurn[];
    executed: ScheduledBurn[];
    totalOwedPercent: number;
    totalExecutedPercent: number;
  } {
    const owed = getOwedBurns();
    const executed = this.scheduledBurns.filter(b => b.executed);

    return {
      owed,
      scheduled: this.scheduledBurns.filter(b => !b.executed),
      executed,
      totalOwedPercent: owed.reduce((sum: number, t: BurnTarget) => sum + t.burnAllocationPercent, 0),
      totalExecutedPercent: executed.reduce((sum: number, b: ScheduledBurn) => sum + b.target.burnAllocationPercent, 0),
    };
  }

  private isAlreadyScheduled(slug: string): boolean {
    return this.scheduledBurns.some(b => b.target.slug === slug);
  }
}

/**
 * Milestone checker for community goals
 */
export class MilestoneTracker {
  private milestoneChecks: Map<string, MilestoneCheck> = new Map();

  registerMilestone(slug: string, checkFn: () => Promise<boolean>) {
    this.milestoneChecks.set(slug, { slug, checkFn });
  }

  async checkAllMilestones(): Promise<string[]> {
    const achieved: string[] = [];

    for (const [slug, check] of this.milestoneChecks) {
      try {
        const isAchieved = await check.checkFn();
        check.lastChecked = new Date();

        if (isAchieved) {
          achieved.push(slug);
          console.log(`🏆 Milestone achieved: ${slug}`);
        }
      } catch (error) {
        console.error(`Error checking milestone ${slug}:`, error);
      }
    }

    return achieved;
  }
}

// Example usage
export async function startScheduler() {
  const scheduler = new BurnScheduler(
    process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
  );

  // Set up callbacks for social media integration
  scheduler.onBurnExecuted = async (target: BurnTarget, signature: string) => {
    console.log(`\n🐦 TWEET: $LIST BURN EXECUTED!`);
    console.log(`   ${target.name} confirmed on the list!`);
    console.log(`   ${target.burnAllocationPercent}% of supply BURNED 🔥`);
    console.log(`   TX: ${signature}`);
  };

  scheduler.onBurnDetected = async (target: BurnTarget) => {
    console.log(`\n🐦 TWEET: BURN INCOMING!`);
    console.log(`   ${target.name} just confirmed!`);
    console.log(`   ${target.burnAllocationPercent}% burn scheduled...`);
  };

  // Start the scheduler
  scheduler.start(60000); // Check every minute

  return scheduler;
}
