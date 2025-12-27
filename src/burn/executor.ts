/**
 * LIST Token Burn Executor
 *
 * Executes token burns on Solana using SPL Token program
 * Triggered when Polymarket predictions are confirmed
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  BurnTarget,
  LIST_TOKEN_MINT,
  DECIMALS,
  calculateBurnAmount,
  getAllTargets,
} from './config';
import { getConfirmedBurns } from './polymarket';

export interface BurnResult {
  target: BurnTarget;
  success: boolean;
  signature?: string;
  error?: string;
  burnedAmount: bigint;
}

export class ListBurnExecutor {
  private connection: Connection;
  private burnAuthority: Keypair;
  private mintPubkey: PublicKey;

  constructor(rpcUrl: string, burnAuthoritySecret: Uint8Array) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.burnAuthority = Keypair.fromSecretKey(burnAuthoritySecret);
    this.mintPubkey = new PublicKey(LIST_TOKEN_MINT);
  }

  /**
   * Check for pending burns and execute them
   */
  async executePendingBurns(): Promise<BurnResult[]> {
    const targets = getAllTargets();
    const pendingBurns = await getConfirmedBurns(targets);

    if (pendingBurns.length === 0) {
      console.log('No pending burns to execute');
      return [];
    }

    console.log(`Found ${pendingBurns.length} pending burns to execute`);

    const results: BurnResult[] = [];
    for (const target of pendingBurns) {
      const result = await this.executeBurn(target);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a single burn for a confirmed target
   */
  async executeBurn(target: BurnTarget): Promise<BurnResult> {
    const burnAmount = calculateBurnAmount(target);

    console.log(`Executing burn for ${target.name}: ${burnAmount.toString()} tokens`);

    try {
      // Get the token account to burn from
      const tokenAccount = await getAssociatedTokenAddress(
        this.mintPubkey,
        this.burnAuthority.publicKey
      );

      // Create burn instruction
      const burnInstruction = createBurnCheckedInstruction(
        tokenAccount,
        this.mintPubkey,
        this.burnAuthority.publicKey,
        burnAmount,
        DECIMALS,
        [],
        TOKEN_PROGRAM_ID
      );

      // Build and send transaction
      const transaction = new Transaction().add(burnInstruction);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.burnAuthority]
      );

      console.log(`Burn successful for ${target.name}: ${signature}`);

      return {
        target: { ...target, status: 'executed', burnTxSignature: signature, executedAt: new Date() },
        success: true,
        signature,
        burnedAmount: burnAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Burn failed for ${target.name}:`, errorMessage);

      return {
        target,
        success: false,
        error: errorMessage,
        burnedAmount: BigInt(0),
      };
    }
  }

  /**
   * Get current burn statistics
   */
  async getBurnStats(): Promise<{
    totalBurned: bigint;
    pendingBurns: number;
    confirmedBurns: number;
    remainingAllocation: number;
  }> {
    const targets = getAllTargets();
    const confirmed = targets.filter((t: BurnTarget) => t.status === 'confirmed');
    const pending = targets.filter((t: BurnTarget) => t.status === 'pending');

    const totalBurned = confirmed.reduce(
      (sum: bigint, t: BurnTarget) => sum + calculateBurnAmount(t),
      BigInt(0)
    );

    const remainingAllocation = pending.reduce(
      (sum: number, t: BurnTarget) => sum + t.burnAllocationPercent,
      0
    );

    return {
      totalBurned,
      pendingBurns: pending.length,
      confirmedBurns: confirmed.length,
      remainingAllocation,
    };
  }

  /**
   * Verify a burn transaction on-chain
   */
  async verifyBurn(signature: string): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      });
      return tx !== null && tx.meta?.err === null;
    } catch {
      return false;
    }
  }
}
