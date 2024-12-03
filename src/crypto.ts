import {
  encodeAbiParameters,
  keccak256,
  SignableMessage,
  Hex,
  getAddress,
  hashTypedData,
  SignTypedDataParameters,
  createWalletClient,
  http,
  privateKeyToAccount
} from 'viem';
import { type CompactMessage } from './validation';

// EIP-712 domain for The Compact
const DOMAIN = {
  name: 'The Compact',
  version: '0',
  verifyingContract: '0x00000000000018DF021Ff2467dF97ff846E09f48'
} as const;

// Type definitions for EIP-712 typed data
const COMPACT_TYPES = {
  Compact: [
    { name: 'arbiter', type: 'address' },
    { name: 'sponsor', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expires', type: 'uint256' },
    { name: 'id', type: 'uint256' },
    { name: 'amount', type: 'uint256' }
  ]
} as const;

const COMPACT_WITH_WITNESS_TYPES = {
  Compact: [
    { name: 'arbiter', type: 'address' },
    { name: 'sponsor', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expires', type: 'uint256' },
    { name: 'id', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'witnessTypeString', type: 'string' },
    { name: 'witnessHash', type: 'bytes32' }
  ]
} as const;

// Initialize wallet client with private key
const privateKey = process.env.PRIVATE_KEY as Hex;
if (!privateKey) {
  throw new Error('PRIVATE_KEY environment variable is required');
}

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
  account,
  transport: http()
});

export async function generateClaimHash(
  compact: CompactMessage,
  chainId: bigint
): Promise<Hex> {
  // Normalize addresses
  const normalizedArbiter = getAddress(compact.arbiter);
  const normalizedSponsor = getAddress(compact.sponsor);

  if (!compact.witnessTypeString || !compact.witnessHash) {
    // Generate hash without witness data
    return hashTypedData({
      domain: { ...DOMAIN, chainId },
      types: COMPACT_TYPES,
      primaryType: 'Compact',
      message: {
        arbiter: normalizedArbiter,
        sponsor: normalizedSponsor,
        nonce: compact.nonce,
        expires: compact.expires,
        id: compact.id,
        amount: BigInt(compact.amount)
      }
    });
  } else {
    // Generate hash with witness data
    return hashTypedData({
      domain: { ...DOMAIN, chainId },
      types: COMPACT_WITH_WITNESS_TYPES,
      primaryType: 'Compact',
      message: {
        arbiter: normalizedArbiter,
        sponsor: normalizedSponsor,
        nonce: compact.nonce,
        expires: compact.expires,
        id: compact.id,
        amount: BigInt(compact.amount),
        witnessTypeString: compact.witnessTypeString,
        witnessHash: compact.witnessHash as Hex
      }
    });
  }
}

export async function signCompact(
  hash: Hex,
  chainId: bigint
): Promise<Hex> {
  return walletClient.signMessage({
    message: { raw: hash },
    account
  });
}

export function getSigningAddress(): string {
  return account.address;
}

// Utility function to verify our signing address matches configuration
export function verifySigningAddress(): void {
  const configuredAddress = process.env.SIGNING_ADDRESS;
  if (!configuredAddress) {
    throw new Error('SIGNING_ADDRESS environment variable is required');
  }

  const normalizedConfigured = getAddress(configuredAddress);
  const normalizedActual = getAddress(account.address);

  if (normalizedConfigured !== normalizedActual) {
    throw new Error(
      `Configured signing address ${normalizedConfigured} does not match derived address ${normalizedActual}`
    );
  }
}