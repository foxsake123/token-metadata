// Add this code to your updateMetadata.js file or create a new file called verifyMetadata.js

const { Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');

async function verifyMetadata() {
  // Set up connection
  const connection = new Connection(clusterApiUrl('mainnet-beta'));

  // Your mint address
  const mintPublicKey = new PublicKey('5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM');

  // Get metadata PDA
  const metadataPDA = new PublicKey('DoY3jmhDz9C9uSfkQGAoNLJS1bGzERkxLcnRpWe65Kh9');

  try {
    // Fetch the metadata account
    const metadataAccount = await Metadata.fromAccountAddress(connection, metadataPDA);
    
    console.log('\nMetadata Details:');
    console.log('================');
    console.log('Name:', metadataAccount.data.name);
    console.log('Symbol:', metadataAccount.data.symbol);
    console.log('URI:', metadataAccount.data.uri);
    console.log('Seller Fee Basis Points:', metadataAccount.data.sellerFeeBasisPoints);
    console.log('Creators:', metadataAccount.data.creators?.map(creator => ({
      address: creator.address.toBase58(),
      verified: creator.verified,
      share: creator.share
    })));
    console.log('Is Mutable:', metadataAccount.isMutable);

    // Try to fetch the URI content
    try {
      const response = await fetch(metadataAccount.data.uri);
      const jsonData = await response.json();
      console.log('\nOff-chain Metadata:');
      console.log('==================');
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('\nCould not fetch off-chain metadata:', e.message);
    }

  } catch (error) {
    console.error('Error fetching metadata:', error);
  }
}

verifyMetadata().catch(console.error);