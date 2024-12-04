# Smallocator

A minimalistic server-based allocator for [The Compact](https://github.com/Uniswap/the-compact). Smallocator provides an API for sponsors to request resource lock allocations across multiple blockchains, with support for EIP-4361 session authentication and signing EIP-712 `Compact` messages.

> ⚠️ Smallocator is under developement and is intended to serve as a reference for understanding server-based allocator functionality and for testing purposes. Use caution when using Smallocator in a production environment.

## Features

- 🔐 Secure session-based authentication for sponsors using EIP-4361
- 📝 EIP-712 Compact message validation and signing on demand from session-gated sponsors
- 🤫 No witness data or signature provided, keeping sponsor intents secret (only the typestring and witness hash is supplied)
- 📊 GraphQL integration with [The Compact Indexer](https://github.com/Uniswap/the-compact-indexer) for multi-chain indexing
- 💾 Persistent storage using PGLite to track attested compacts and used nonces
- ✅ Comprehensive validation pipeline to ensure resource locks never end up in an overallocated state

## API Usage

### Authentication

1. **Get Session Payload**

   ```http
   GET /session/:address
   ```

   Returns an EIP-4361 payload for signing. Example response:

   ```json
   {
     "payload": {
       "domain": "localhost:3000",
       "address": "0x...",
       "uri": "http://localhost:3000",
       "statement": "Sign in to Smallocator",
       "version": "1",
       "chainId": 1,
       "nonce": "unique_nonce",
       "issuedAt": "2024-12-03T12:00:00Z",
       "expirationTime": "2024-12-03T13:00:00Z",
       "resources": ["http://localhost:3000/resources"]
     }
   }
   ```

2. **Create Session**
   ```http
   POST /session
   ```
   Submit the signed payload to create a session. Example request:
   ```json
   {
     "signature": "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
     "payload": {
       "domain": "localhost:3000",
       "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
       "uri": "http://localhost:3000",
       "statement": "Sign in to Smallocator",
       "version": "1",
       "chainId": 1,
       "nonce": "d6e1c0c4-3d78-4daa-9e57-5485b7c8c6c3",
       "issuedAt": "2024-03-07T12:00:00.000Z",
       "expirationTime": "2024-03-07T13:00:00.000Z",
       "resources": ["http://localhost:3000/resources"]
     }
   }
   ```
   Returns a session ID for subsequent requests.

### Compact Operations

All compact operations require a valid session ID in the `x-session-id` header.

1. **Submit Compact**

   ```http
   POST /compact
   ```

   Example request:

   ```json
   {
     "chainId": "10",
     "compact": {
       "arbiter": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
       "sponsor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
       "nonce": "0x70997970C51812dc3A010C7d01b50e0d17dc79C800000000000000000000001",
       "expires": "1732520000",
       "id": "0x300000000000000000000000000000000000000000000000000000000000001c",
       "amount": "1000000000000000000",
       "witnessTypeString": "ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)",
       "witnessHash": "0x0000000000000000000000000000000000000000000000000000000000000123"
     }
   }
   ```

   Example response:

   ```json
   {
     "hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
     "signature": "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890"
   }
   ```

2. **Get Compacts by Address**

   ```http
   GET /compacts
   ```

   Example response:

   ```json
   [
     {
       "chainId": "10",
       "hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
       "compact": {
         "arbiter": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
         "sponsor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
         "nonce": "0x70997970C51812dc3A010C7d01b50e0d17dc79C800000000000000000000001",
         "expires": "1732520000",
         "id": "0x300000000000000000000000000000000000000000000000000000000000001c",
         "amount": "1000000000000000000",
         "witnessTypeString": "ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)",
         "witnessHash": "0x0000000000000000000000000000000000000000000000000000000000000123"
       },
       "signature": "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
       "createdAt": "2024-03-07T12:00:00Z"
     }
   ]
   ```

3. **Get Specific Compact**
   ```http
   GET /compact/:chainId/:claimHash
   ```
   Example response:
   ```json
   {
     "chainId": "10",
     "hash": "0x1234567890123456789012345678901234567890123456789012345678901234",
     "compact": {
       "arbiter": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
       "sponsor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
       "nonce": "0x70997970C51812dc3A010C7d01b50e0d17dc79C800000000000000000000001",
       "expires": "1732520000",
       "id": "0x300000000000000000000000000000000000000000000000000000000000001c",
       "amount": "1000000000000000000",
       "witnessTypeString": "ExampleWitness exampleWitness)ExampleWitness(uint256 foo, bytes32 bar)",
       "witnessHash": "0x0000000000000000000000000000000000000000000000000000000000000123"
     },
     "signature": "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
     "createdAt": "2024-03-07T12:00:00Z"
   }
   ```

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 9.14.1
- TypeScript >= 5.2

### Configuration

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Configure the following variables in `.env`:

   ```shell
   # Server Configuration
   BASE_URL=http://localhost:3000
   PORT=3000
   CORS_ORIGIN=*

   # Database Configuration
   DATABASE_URL=sqlite://smallocator.db

   # Crypto Configuration
   PRIVATE_KEY=your_private_key_here
   ALLOCATOR_ADDRESS=signing_address_or_contract_address
   SIGNING_ADDRESS=derived_from_private_key

   # External Services
   INDEXER_URL=https://the-compact-indexer-2.ponder-dev.com/
   ```

### Installation

```bash
# Install dependencies
pnpm install
```

### Development Commands

```bash
# Run in development mode with hot reload
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build

# Start production server
pnpm start
```

### Testing

The project includes comprehensive test suites:

- Unit tests for core functionality
- Integration tests for API endpoints
- Validation tests for compact messages

Run all tests with:

```bash
pnpm test
```

### Code Quality

The project uses:

- ESLint for code linting
- Prettier for code formatting
- Husky for git hooks
- lint-staged for pre-commit checks

Pre-commit hooks ensure:

- Code is properly formatted
- Tests pass
- No TypeScript errors
- No ESLint warnings

## License

MIT
