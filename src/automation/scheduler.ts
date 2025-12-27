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
  EPSTEIN_ACTIVE_BURNS,
  DIDDY_SENTENCE_BURNS,
  DIDDY_BONUS_BURNS,
  getOwedBurns,
  calculateBurnAmount,
  formatBurnAmount,
} from '../burn/config';
import { checkConfirmedPredictions } from '../burn/polymarket';
import {
  isBurnRecorded,
  isBurnExecuted,
  recordBurnDetected,
  recordBurnExecuted,
  getStorageStats,
} from './storage';

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

export interface BurnSchedulerOptions {
  rpcUrl: string;
  burnAuthoritySecret?: Uint8Array;
  requireConfirmation?: boolean; // If true, burns require manual approval
  autoExecute?: boolean; // If true, execute burns automatically (default: false for safety)
}

export class BurnScheduler {
  private scheduledBurns: ScheduledBurn[] = [];
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private pendingApprovals: Map<string, ScheduledBurn> = new Map();
  private options: BurnSchedulerOptions;

  // Callbacks
  public onBurnDetected?: (target: BurnTarget) => Promise<void>;
  public onBurnExecuted?: (target: BurnTarget, signature: string) => Promise<void>;
  public onBurnPendingApproval?: (target: BurnTarget) => Promise<void>;

  constructor(rpcUrlOrOptions: string | BurnSchedulerOptions, burnAuthoritySecret?: Uint8Array) {
    if (typeof rpcUrlOrOptions === 'string') {
      // Legacy constructor
      this.options = {
        rpcUrl: rpcUrlOrOptions,
        burnAuthoritySecret,
        requireConfirmation: true, // Default to safe mode
        autoExecute: false,
      };
    } else {
      this.options = {
        requireConfirmation: true,
        autoExecute: false,
        ...rpcUrlOrOptions,
      };
    }
  }

  /**
   * Check if confirmation is required for burns
   */
  get requiresConfirmation(): boolean {
    return this.options.requireConfirmation ?? true;
  }

  /**
   * Get list of burns pending approval
   */
  getPendingApprovals(): ScheduledBurn[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Approve a pending burn for execution
   */
  approveBurn(slug: string): boolean {
    const burn = this.pendingApprovals.get(slug);
    if (!burn) {
      console.error(`❌ No pending approval for: ${slug}`);
      return false;
    }

    this.pendingApprovals.delete(slug);
    this.scheduledBurns.push(burn);
    console.log(`✅ Approved burn for execution: ${burn.target.name}`);
    return true;
  }

  /**
   * Reject a pending burn
   */
  rejectBurn(slug: string): boolean {
    const burn = this.pendingApprovals.get(slug);
    if (!burn) {
      console.error(`❌ No pending approval for: ${slug}`);
      return false;
    }

    this.pendingApprovals.delete(slug);
    console.log(`🚫 Rejected burn: ${burn.target.name}`);
    return true;
  }

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
    let confirmed: string[];
    try {
      confirmed = await checkConfirmedPredictions();
    } catch (error) {
      // Log but don't crash - we'll retry on next scheduled check
      console.error(`⚠️ Polymarket check failed, will retry: ${error instanceof Error ? error.message : error}`);
      return [];
    }

    const newlyConfirmed: string[] = [];

    for (const name of confirmed) {
      const target = [...EPSTEIN_ACTIVE_BURNS, ...DIDDY_SENTENCE_BURNS, ...DIDDY_BONUS_BURNS]
        .find((t: BurnTarget) => t.name.toLowerCase() === name.toLowerCase() && t.status === 'pending');

      if (!target) continue;

      // Check both in-memory, pending approvals, and persistent storage
      const alreadyTracked = this.isAlreadyScheduled(target.slug) ||
        this.pendingApprovals.has(target.slug) ||
        isBurnRecorded(target.slug);

      if (!alreadyTracked) {
        // Create a copy with updated status to avoid mutating imported constants
        const confirmedTarget: BurnTarget = { ...target, status: 'confirmed' };
        const burn: ScheduledBurn = {
          target: confirmedTarget,
          scheduledFor: new Date(),
          executed: false,
        };

        // Persist to storage
        recordBurnDetected(target.slug, target.name, target.burnAllocationPercent);
        newlyConfirmed.push(name);

        // If confirmation required, add to pending approvals instead of scheduled burns
        if (this.requiresConfirmation) {
          this.pendingApprovals.set(target.slug, burn);
          console.log(`🔔 New confirmation requiring approval: ${name} (${target.burnAllocationPercent}%)`);
          await this.onBurnPendingApproval?.(confirmedTarget);
        } else {
          this.scheduledBurns.push(burn);
          console.log(`🆕 New confirmation: ${name} - scheduling burn`);
          await this.onBurnDetected?.(confirmedTarget);
        }
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

        // Persist execution to storage
        recordBurnExecuted(burn.target.slug, burn.txSignature);

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
   * Get summary of all burns (includes persistent storage stats)
   */
  getSummary(): {
    owed: BurnTarget[];
    scheduled: ScheduledBurn[];
    executed: ScheduledBurn[];
    totalOwedPercent: number;
    totalExecutedPercent: number;
    storageStats: ReturnType<typeof getStorageStats>;
  } {
    const owed = getOwedBurns();
    const executed = this.scheduledBurns.filter(b => b.executed);

    return {
      owed,
      scheduled: this.scheduledBurns.filter(b => !b.executed),
      executed,
      totalOwedPercent: owed.reduce((sum: number, t: BurnTarget) => sum + t.burnAllocationPercent, 0),
      totalExecutedPercent: executed.reduce((sum: number, b: ScheduledBurn) => sum + b.target.burnAllocationPercent, 0),
      storageStats: getStorageStats(),
    };
  }

  private isAlreadyScheduled(slug: string): boolean {
    // Check both in-memory and persistent storage
    return this.scheduledBurns.some(b => b.target.slug === slug) || isBurnRecorded(slug);
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
