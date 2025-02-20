// updateMetadata.js

const { Connection, clusterApiUrl, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { createCreateMetadataAccountV3Instruction } = require('@metaplex-foundation/mpl-token-metadata');
const fs = require('fs');

async function main() {
  // Set up the connection
  const connection = new Connection(clusterApiUrl('mainnet-beta'));

  // Load wallet from file
  const secretKeyString = fs.readFileSync('C:\\Users\\shorg\\.config\\solana\\id.json', 'utf8');
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  const wallet = Keypair.fromSecretKey(secretKey);
  console.log("Wallet Public Key:", wallet.publicKey.toBase58());

  // Mint address
  const mintPublicKey = new PublicKey('5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM');
  console.log("Mint Public Key:", mintPublicKey.toBase58());

  // Token Metadata Program ID
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // Calculate the metadata account PDA
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  console.log("Metadata Account:", metadataAccount.toBase58());

  // Create the Metadata V3 Data object
  const onChainData = {
    name: "List Drop",
    symbol: "LIST",
    uri: "https://foxsake123.github.io/token-metadata/metadata.json",
    sellerFeeBasisPoints: 0,
    creators: [
      {
        address: wallet.publicKey,
        verified: true,
        share: 100
      }
    ],
    collection: null,
    uses: null
  };

  try {
    // Create instruction
    const instruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataAccount,
        mint: mintPublicKey,
        mintAuthority: wallet.publicKey,
        payer: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: onChainData,
          isMutable: true,
          collectionDetails: null
        }
      }
    );

    // Create transaction and add the instruction
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = wallet.publicKey;

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    console.log("Transaction sent with signature:", signature);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log("Transaction confirmed!");

  } catch (error) {
    console.error("Error:", error);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
});