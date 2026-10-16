import { CognitoJwtVerifier } from "aws-jwt-verify";

export interface TokenVerifier {
  /** The owner id (Cognito `sub`) of a valid access token, or null. */
  verify(token: string): Promise<string | null>;
}

export interface AuthConfig {
  /** Public: the Cognito login page and app client the browser starts the login with. */
  domain: string;
  clientId: string;
}

// Access tokens from our user pool and app client only; signature, expiry, issuer and
// token_use are checked against the pool's public keys (cached by the library).
export function cognitoVerifier(userPoolId: string, clientId: string): TokenVerifier {
  const verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: "access" });
  return {
    async verify(token) {
      try {
        return (await verifier.verify(token)).sub;
      } catch {
        return null;
      }
    },
  };
}
