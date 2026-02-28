/**
 * Lazily import and return a cached Resend client instance.
 * Using dynamic import prevents bundlers from resolving the `resend`
 * package at module-evaluation time which can cause build issues in some
 * deployment environments.
 */
let _cachedResend: InstanceType<typeof import('resend').Resend> | null = null;

export async function getResend() {
	if (_cachedResend) return _cachedResend;

	const apiKey = process.env.RESEND_API_KEY
	if (!apiKey) {
		throw new Error('RESEND_API_KEY is not configured')
	}

	const mod = await import('resend')
	const { Resend } = mod as typeof import('resend')
	_cachedResend = new Resend(apiKey)
	return _cachedResend
}
