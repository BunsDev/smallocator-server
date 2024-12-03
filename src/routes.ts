import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAddress } from 'viem';
import { validateAndCreateSession, verifySession, type SessionPayload } from './session';
import { submitCompact, getCompactsByAddress, getCompactByHash, type CompactSubmission, type CompactRecord } from './compact';

// Authentication middleware
async function authenticateRequest(
  request: FastifyRequest<{ Headers: { 'x-session-id'?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const sessionId = request.headers['x-session-id'];
  if (!sessionId) {
    reply.code(401).send({ error: 'Session ID required' });
    return;
  }

  try {
    const session = await verifySession(server, sessionId);
    if (!session) {
      reply.code(401).send({ error: 'Invalid session' });
      return;
    }
  } catch (err) {
    server.log.error('Session verification failed:', err);
    reply.code(401).send({ error: 'Invalid session' });
    return;
  }
}

export async function setupRoutes(server: FastifyInstance): Promise<void> {
  // Health check endpoint
  server.get('/health', async (): Promise<{ status: string; allocatorAddress: string; signingAddress: string }> => {
    return {
      status: 'healthy',
      allocatorAddress: process.env.ALLOCATOR_ADDRESS,
      signingAddress: process.env.SIGNING_ADDRESS
    };
  });

  // Get session payload
  server.get('/session/:address', async (
    request: FastifyRequest<{ Params: { address: string } }>,
    reply: FastifyReply
  ): Promise<{ payload: SessionPayload } | { error: string }> => {
    const { address } = request.params as { address: string };
    
    try {
      const normalizedAddress = getAddress(address);
      const nonce = Date.now().toString();
      const payload = {
        domain: 'smallocator.example',
        address: normalizedAddress,
        uri: 'https://smallocator.example',
        statement: 'Sign in to Smallocator',
        version: '1',
        chainId: 1,
        nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 3600000).toISOString(),
        resources: ['https://smallocator.example/resources']
      };

      // Store nonce
      await server.db.query(
        'INSERT INTO nonces (domain, nonce) VALUES ($1, $2)',
        ['smallocator.example', nonce]
      );

      return { payload };
    } catch {
      reply.code(400).send({ error: 'Invalid address' });
    }
  });

  // Create session
  server.post<{
    Body: {
      signature: string;
      payload: SessionPayload;
    };
  }>('/session', async (
    request: FastifyRequest<{ Body: { signature: string; payload: SessionPayload } }>,
    reply: FastifyReply
  ): Promise<{ session: SessionPayload } | { error: string }> => {
    try {
      const { signature, payload } = request.body;
      const session = await validateAndCreateSession(server, signature, payload);
      reply.send({ session });
    } catch (err) {
      server.log.error('Session creation failed:', err);
      reply.status(400).send({ 
        error: err instanceof Error ? err.message : 'Failed to create session' 
      });
    }
  });

  // Protected routes
  server.register(async function (protectedRoutes) {
    // Add authentication to all routes in this context
    protectedRoutes.addHook('preHandler', authenticateRequest);

    // Submit a new compact
    protectedRoutes.post<{
      Body: CompactSubmission;
    }>('/compact', async (
      request: FastifyRequest<{ Body: CompactSubmission }>,
      reply: FastifyReply
    ): Promise<{ result: { hash: string; signature: string } } | { error: string }> => {
      try {
        const session = await server.db.query(
          'SELECT address FROM sessions WHERE id = $1',
          [request.headers['x-session-id']]
        );

        const result = await submitCompact(
          server,
          request.body,
          session.rows[0].address
        );
        reply.send({ result });
      } catch (err) {
        server.log.error('Error submitting compact:', err);
        reply.status(500).send({ error: 'Internal server error' });
      }
    });

    // Get all compacts for the authenticated user
    protectedRoutes.get('/compacts', async (
      request: FastifyRequest<{ Headers: { 'x-session-id'?: string } }>,
      reply: FastifyReply
    ): Promise<{ compacts: CompactRecord[] } | { error: string }> => {
      try {
        const session = await server.db.query(
          'SELECT address FROM sessions WHERE id = $1',
          [request.headers['x-session-id']]
        );

        const compacts = await getCompactsByAddress(server, session.rows[0].address);
        reply.send({ compacts });
      } catch (err) {
        server.log.error('Error retrieving compacts:', err);
        reply.status(500).send({ error: 'Internal server error' });
      }
    });

    // Get a specific compact by hash
    protectedRoutes.get<{
      Params: {
        chainId: string;
        claimHash: string;
      };
    }>('/compact/:chainId/:claimHash', async (
      request: FastifyRequest<{ Params: { chainId: string; claimHash: string } }>,
      reply: FastifyReply
    ): Promise<{ compact: CompactRecord | null } | { error: string }> => {
      try {
        const { chainId, claimHash } = request.params;
        const compact = await getCompactByHash(server, chainId, claimHash);
        
        if (!compact) {
          reply.status(404).send({ error: 'Compact not found' });
          return;
        }

        reply.send({ compact });
      } catch (err) {
        server.log.error('Error retrieving compact:', err);
        reply.status(500).send({ error: 'Internal server error' });
      }
    });
  });
}
