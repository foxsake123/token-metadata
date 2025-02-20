const { PublicKey } = require('@solana/web3.js');

const mintAddressStr = '5oKiBTTUutgk95g4MEgxUHtWJ9n21QXPSAusL6ic8KgM'; // your string
try {
  const pk = new PublicKey(mintAddressStr);
  console.log('PublicKey is valid:', pk.toBase58());
} catch (error) {
  console.error('Invalid PublicKey:', error);
}
