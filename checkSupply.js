// checkSupply.js
const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const { getMint } = require('@solana/spl-token');

async function checkTokenSupply() {
    // Initialize connection
    const connection = new Connection(clusterApiUrl('mainnet-beta'));
    
    // Your token's mint address
    const mintAddress = new PublicKey('5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM');

    try {
        // Get mint info
        const mintInfo = await getMint(connection, mintAddress);
        
        console.log('\nToken Supply Information:');
        console.log('========================');
        console.log('Total Supply:', mintInfo.supply.toString());
        console.log('Decimals:', mintInfo.decimals);
        
        // Calculate actual supply considering decimals
        const actualSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
        console.log('Actual Supply:', actualSupply);
        
        // If you're the mint authority, it means you can still mint more
        if (mintInfo.mintAuthority) {
            console.log('Mint Authority:', mintInfo.mintAuthority.toString());
            console.log('Additional tokens can still be minted');
        } else {
            console.log('Mint Authority: None (supply is fixed)');
        }
        
        // Check freeze authority
        if (mintInfo.freezeAuthority) {
            console.log('Freeze Authority:', mintInfo.freezeAuthority.toString());
        } else {
            console.log('Freeze Authority: None');
        }
    } catch (error) {
        console.error('Error fetching supply:', error);
    }
}

checkTokenSupply().catch(console.error);