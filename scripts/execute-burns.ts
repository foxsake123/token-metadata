#!/usr/bin/env npx ts-node
/**
 * LIST Token Burn Execution Script
 *
 * Executes all owed burns from confirmed Polymarket resolutions.
 *
 * Usage:
 *   npx ts-node scripts/execute-burns.ts --dry-run    # Preview burns
 *   npx ts-node scripts/execute-burns.ts --execute    # Execute burns
 *
 * Required environment variables:
 *   SOLANA_RPC_URL - Solana RPC endpoint
 *   BURN_AUTHORITY_SECRET - Base58 encoded keypair with burn authority
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as bs58 from 'bs58';

import {
  LIST_TOKEN_MINT,
  DECIMALS,
  EPSTEIN_RESOLVED_BURNS,
  BurnTarget,
  calculateBurnAmount,
  formatBurnAmount,
} from '../src/burn/config';

// =============================================================================
// CONFIGURATION
// =============================================================================

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const BURN_AUTHORITY_SECRET = process.env.BURN_AUTHORITY_SECRET;

// =============================================================================
// HELPERS
// =============================================================================

function loadKeypair(secret: string): Keypair {
  try {
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  } catch {
    // Try JSON array format
    const parsed = JSON.parse(secret);
    return Keypair.fromSecretKey(new Uint8Array(parsed));
  }
}

async function getTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<bigint> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(mint, owner);
    const account = await getAccount(connection, tokenAccount);
    return account.amount;
  } catch {
    return BigInt(0);
  }
}

function formatSOL(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

// =============================================================================
// BURN EXECUTION
// =============================================================================

interface BurnResult {
  target: BurnTarget;
  success: boolean;
  signature?: string;
  error?: string;
  amount: bigint;
}

async function executeBurn(
  connection: Connection,
  authority: Keypair,
  mint: PublicKey,
  target: BurnTarget
): Promise<BurnResult> {
  const burnAmount = calculateBurnAmount(target);

  console.log(`\n🔥 Burning for: ${target.name}`);
  console.log(`   Allocation: ${target.burnAllocationPercent}%`);
  console.log(`   Amount: ${formatBurnAmount(burnAmount)} LIST`);

  try {
    const tokenAccount = await getAssociatedTokenAddress(mint, authority.publicKey);

    const burnInstruction = createBurnCheckedInstruction(
      tokenAccount,
      mint,
      authority.publicKey,
      burnAmount,
      DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(burnInstruction);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authority],
      { commitment: 'confirmed' }
    );

    console.log(`   ✅ Success! TX: ${signature}`);

    return {
      target,
      success: true,
      signature,
      amount: burnAmount,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Failed: ${errorMsg}`);

    return {
      target,
      success: false,
      error: errorMsg,
      amount: burnAmount,
    };
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');

  if (!isDryRun && !isExecute) {
    console.log('Usage:');
    console.log('  npx ts-node scripts/execute-burns.ts --dry-run    # Preview burns');
    console.log('  npx ts-node scripts/execute-burns.ts --execute    # Execute burns');
    process.exit(1);
  }

  console.log('═'.repeat(60));
  console.log('  $LIST TOKEN BURN EXECUTION');
  console.log('  "The more names drop. The more $LIST pops."');
  console.log('═'.repeat(60));

  // Get owed burns
  const owedBurns = EPSTEIN_RESOLVED_BURNS.filter(t => t.status === 'confirmed');

  if (owedBurns.length === 0) {
    console.log('\n✅ No pending burns to execute!');
    process.exit(0);
  }

  console.log(`\n📋 OWED BURNS (${owedBurns.length} total):\n`);

  let totalPercent = 0;
  let totalAmount = BigInt(0);

  for (const target of owedBurns) {
    const amount = calculateBurnAmount(target);
    totalAmount += amount;
    totalPercent += target.burnAllocationPercent;

    console.log(`   ${target.name}`);
    console.log(`     - Allocation: ${target.burnAllocationPercent}%`);
    console.log(`     - Amount: ${formatBurnAmount(amount)} LIST`);
    console.log(`     - Confirmed: ${target.resolvedAt?.toISOString() || 'Unknown'}`);
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log(`   TOTAL: ${totalPercent}% = ${formatBurnAmount(totalAmount)} LIST`);
  console.log('─'.repeat(60));

  if (isDryRun) {
    console.log('\n🔍 DRY RUN - No burns executed');
    console.log('   Run with --execute to perform actual burns');
    process.exit(0);
  }

  // Execute mode
  console.log('\n⚠️  EXECUTE MODE - Burns will be permanent!\n');

  if (!BURN_AUTHORITY_SECRET) {
    console.error('❌ Error: BURN_AUTHORITY_SECRET environment variable not set');
    console.log('\nSet it with your wallet keypair:');
    console.log('  export BURN_AUTHORITY_SECRET="your-base58-private-key"');
    process.exit(1);
  }

  // Connect and validate
  const connection = new Connection(RPC_URL, 'confirmed');
  const authority = loadKeypair(BURN_AUTHORITY_SECRET);
  const mint = new PublicKey(LIST_TOKEN_MINT);

  console.log(`🔗 RPC: ${RPC_URL}`);
  console.log(`👛 Authority: ${authority.publicKey.toBase58()}`);
  console.log(`🪙 Mint: ${LIST_TOKEN_MINT}`);

  // Check balances
  const solBalance = await connection.getBalance(authority.publicKey);
  const tokenBalance = await getTokenBalance(connection, authority.publicKey, mint);

  console.log(`\n💰 Balances:`);
  console.log(`   SOL: ${formatSOL(solBalance)}`);
  console.log(`   LIST: ${formatBurnAmount(tokenBalance)}`);

  if (solBalance < 0.01 * LAMPORTS_PER_SOL) {
    console.error('\n❌ Insufficient SOL for transaction fees');
    process.exit(1);
  }

  if (tokenBalance < totalAmount) {
    console.error('\n❌ Insufficient LIST tokens for burns');
    console.error(`   Need: ${formatBurnAmount(totalAmount)}`);
    console.error(`   Have: ${formatBurnAmount(tokenBalance)}`);
    process.exit(1);
  }

  // Confirm execution
  console.log('\n⏳ Starting burn execution in 5 seconds...');
  console.log('   Press Ctrl+C to cancel');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Execute burns
  const results: BurnResult[] = [];

  for (const target of owedBurns) {
    const result = await executeBurn(connection, authority, mint, target);
    results.push(result);

    // Small delay between burns
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  BURN EXECUTION SUMMARY');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}`);
  for (const r of successful) {
    console.log(`   - ${r.target.name}: ${r.signature}`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    for (const r of failed) {
      console.log(`   - ${r.target.name}: ${r.error}`);
    }
  }

  const burnedAmount = successful.reduce((sum, r) => sum + r.amount, BigInt(0));
  const burnedPercent = successful.reduce((sum, r) => sum + r.target.burnAllocationPercent, 0);

  console.log(`\n🔥 Total Burned: ${burnedPercent}% = ${formatBurnAmount(burnedAmount)} LIST`);
  console.log('═'.repeat(60));

  // Output for social media
  if (successful.length > 0) {
    console.log('\n📢 TWEET CONTENT:\n');
    console.log('─'.repeat(60));
    console.log(`🔥 MASSIVE BURN EXECUTED 🔥

${successful.length} names confirmed on the Epstein list.
${burnedPercent}% of $LIST supply = GONE FOREVER

${successful.map(r => `✅ ${r.target.name}: ${r.target.burnAllocationPercent}%`).join('\n')}

${formatBurnAmount(burnedAmount)} tokens burned 💀

The truth burns. $LIST rises.

#LIST #Solana #TokenBurn`);
    console.log('─'.repeat(60));
  }
}

main().catch(console.error);
