/**
 * Lazily import and return a Resend client instance.
 * Using dynamic import prevents bundlers from resolving the `resend`
 * package at module-evaluation time which can cause build issues in some
 * deployment environments.
 */
export async function getResend() {
	const apiKey = process.env.RESEND_API_KEY
	if (!apiKey) {
		throw new Error('RESEND_API_KEY is not configured')
	}

	const mod = await import('resend')
	const { Resend } = mod as typeof import('resend')
	return new Resend(apiKey)
}
