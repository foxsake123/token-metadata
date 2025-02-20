// revokeMintAuthority.js
const { Connection, clusterApiUrl, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { createSetAuthorityInstruction, AuthorityType } = require('@solana/spl-token');
const fs = require('fs');

async function revokeMintAuthority() {
    // Initialize connection
    const connection = new Connection(clusterApiUrl('mainnet-beta'));
    
    // Load your wallet
    const secretKeyString = fs.readFileSync('C:\\Users\\shorg\\.config\\solana\\id.json', 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const wallet = Keypair.fromSecretKey(secretKey);
    
    // Your token's mint address
    const mintAddress = new PublicKey('5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM');

    try {
        // Create instruction to set mint authority to null
        const instruction = createSetAuthorityInstruction(
            mintAddress,           // mint account
            wallet.publicKey,      // current authority
            AuthorityType.MintTokens, // authority type
            null                   // new authority (null means remove authority)
        );

        // Create and sign transaction
        const transaction = new Transaction().add(instruction);
        transaction.feePayer = wallet.publicKey;
        
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // Sign and send transaction
        transaction.sign(wallet);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        
        console.log('Revoking mint authority...');
        await connection.confirmTransaction(signature);
        console.log('✅ Mint authority has been revoked. No more tokens can be minted.');
        console.log('Transaction signature:', signature);
    } catch (error) {
        console.error('Error revoking mint authority:', error);
    }
}

revokeMintAuthority().catch(console.error);