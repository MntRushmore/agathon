import { SignJWT, importPKCS8 } from 'jose';

// Service account credentials from environment
const SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: process.env.VERTEX_PROJECT_ID || '',
  private_key: process.env.VERTEX_PRIVATE_KEY || '',
  client_email: process.env.VERTEX_CLIENT_EMAIL || '',
  token_uri: 'https://oauth2.googleapis.com/token',
};

let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Generate a signed JWT for Google OAuth
 */
async function createSignedJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Import the private key
  const privateKey = await importPKCS8(
    SERVICE_ACCOUNT.private_key.replace(/\\n/g, '\n'),
    'RS256'
  );

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(SERVICE_ACCOUNT.client_email)
    .setSubject(SERVICE_ACCOUNT.client_email)
    .setAudience(SERVICE_ACCOUNT.token_uri)
    .setIssuedAt(now)
    .setExpirationTime(expiry)
    .sign(privateKey);

  return jwt;
}

/**
 * Exchange signed JWT for an access token
 */
async function exchangeJWTForToken(jwt: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  return response.json();
}

/**
 * Get a valid access token for Vertex AI, using cache when possible
 */
export async function getVertexAccessToken(): Promise<string | null> {
  // Check if service account is configured
  if (!SERVICE_ACCOUNT.private_key || !SERVICE_ACCOUNT.client_email) {
    return null;
  }

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiry > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  try {
    const jwt = await createSignedJWT();
    const tokenResponse = await exchangeJWTForToken(jwt);

    cachedToken = {
      token: tokenResponse.access_token,
      expiry: Date.now() + tokenResponse.expires_in * 1000,
    };

    return cachedToken.token;
  } catch (error) {
    console.error('Failed to get Vertex access token:', error);
    return null;
  }
}

/**
 * Check if service account auth is configured
 */
export function isServiceAccountConfigured(): boolean {
  return !!(SERVICE_ACCOUNT.private_key && SERVICE_ACCOUNT.client_email && SERVICE_ACCOUNT.project_id);
}
