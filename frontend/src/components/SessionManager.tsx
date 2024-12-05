import { useAccount, useSignMessage, useChainId } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';

interface SessionManagerProps {
  sessionToken: string | null;
  onSessionUpdate: (token: string | null) => void;
}

export function SessionManager({ sessionToken, onSessionUpdate }: SessionManagerProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing session on mount and when wallet connects
  useEffect(() => {
    const validateSession = async () => {
      const existingSession = localStorage.getItem('sessionId');
      if (!existingSession) {
        onSessionUpdate(null);
        return;
      }

      try {
        // Verify the session is still valid
        const response = await fetch('/session', {
          headers: {
            'x-session-id': existingSession
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.session?.id === existingSession) {
            onSessionUpdate(existingSession);
            return;
          }
        }
        // Session is invalid or expired
        localStorage.removeItem('sessionId');
        onSessionUpdate(null);
      } catch (error) {
        console.error('Failed to validate session:', error);
        localStorage.removeItem('sessionId');
        onSessionUpdate(null);
      }
    };

    validateSession();
  }, [onSessionUpdate]); // Run on mount and when onSessionUpdate changes

  // Re-validate when wallet connects
  useEffect(() => {
    if (isConnected) {
      const validateSession = async () => {
        const existingSession = localStorage.getItem('sessionId');
        if (!existingSession) return;

        try {
          // Verify the session is still valid
          const response = await fetch('/session', {
            headers: {
              'x-session-id': existingSession
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.session?.id === existingSession) {
              onSessionUpdate(existingSession);
              return;
            }
          }
          // Session is invalid or expired
          localStorage.removeItem('sessionId');
          onSessionUpdate(null);
        } catch (error) {
          console.error('Failed to validate session:', error);
          localStorage.removeItem('sessionId');
          onSessionUpdate(null);
        }
      };

      validateSession();
    }
  }, [isConnected, onSessionUpdate]);

  const createSession = useCallback(async () => {
    if (!address || !chainId || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      // First, get the payload from server
      const payloadResponse = await fetch(`/session/${chainId}/${address}`);
      if (!payloadResponse.ok) {
        throw new Error('Failed to get session payload');
      }
      
      const { session } = await payloadResponse.json();
      
      // Format the message according to EIP-4361
      const message = [
        `${session.domain} wants you to sign in with your Ethereum account:`,
        session.address,
        '',
        session.statement,
        '',
        `URI: ${session.uri}`,
        `Version: ${session.version}`,
        `Chain ID: ${session.chainId}`,
        `Nonce: ${session.nonce}`,
        `Issued At: ${session.issuedAt}`,
        `Expiration Time: ${session.expirationTime}`,
      ].join('\n');

      // Get signature from wallet
      const signature = await signMessageAsync({
        message,
      });

      // Submit signature and payload to create session
      const response = await fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          payload: {
            ...session,
            chainId: parseInt(session.chainId.toString(), 10), // Ensure chainId is a number
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const sessionId = data.session.id;
        localStorage.setItem('sessionId', sessionId);
        onSessionUpdate(sessionId);
      } else {
        const errorText = await response.text();
        console.error('Failed to create session:', errorText);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessageAsync, onSessionUpdate, isLoading]);

  const signOut = useCallback(async () => {
    if (!sessionToken || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/session', {
        method: 'DELETE',
        headers: {
          'x-session-id': sessionToken
        }
      });

      if (response.ok) {
        localStorage.removeItem('sessionId');
        onSessionUpdate(null);
      } else {
        console.error('Failed to sign out:', await response.text());
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, onSessionUpdate, isLoading]);

  if (!isConnected) {
    return (
      <div className="text-center">
        <p className="text-gray-600">Please connect your wallet to continue.</p>
      </div>
    );
  }

  if (sessionToken) {
    return (
      <div className="text-center">
        <button
          onClick={signOut}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium ${
            isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isLoading ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    );
  }

  const canLogin = isConnected && address && chainId && !isLoading;

  return (
    <div className="text-center">
      <button
        onClick={createSession}
        disabled={!canLogin}
        className={`px-4 py-2 rounded-lg font-medium ${
          canLogin
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Signing in...' : 'Sign in with Ethereum'}
      </button>
    </div>
  );
}