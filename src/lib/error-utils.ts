export function mapSupabaseError(err: unknown): string {
  // Normalize Error-like shapes
  const message = err && typeof err === 'object' && 'message' in err ? (err as any).message : undefined;
  const code = err && typeof err === 'object' && 'code' in err ? (err as any).code : undefined;

  // Common mappings — expand as needed
  if (code === '23505' || /unique constraint/i.test(String(message))) {
    return 'An account with that information already exists.';
  }

  if (/invalid login|invalid email|invalid password|invalid_credentials/i.test(String(message))) {
    return 'Invalid email or password.';
  }

  if (/User not found|No user exists|not found/i.test(String(message))) {
    return 'No account found with that email address.';
  }

  if (/expired|expired_token|token has expired/i.test(String(message))) {
    return 'This link has expired. Please try again.';
  }

  if (/password/i.test(String(message)) && /incorrect|invalid/i.test(String(message))) {
    return 'Incorrect password. Please try again.';
  }

  // Default fallback (do not show raw technical details)
  return 'Something went wrong. Please try again.';
}
