export interface AccessTokenProvider {
  getAccessToken(audience: string): Promise<string | null>;
}

let provider: AccessTokenProvider | null = null;

export function installAccessTokenProvider(next: AccessTokenProvider): void {
  provider = next;
}

export function hasAccessTokenProvider(): boolean {
  return provider !== null;
}

export async function getAccessToken(audience: string): Promise<string> {
  if (!provider) {
    throw new Error('auth_provider_not_installed');
  }

  const token = await provider.getAccessToken(audience);
  if (!token?.trim()) {
    throw new Error('auth_token_missing');
  }
  return token;
}

export function clearAccessTokenProviderForTests(): void {
  provider = null;
}
