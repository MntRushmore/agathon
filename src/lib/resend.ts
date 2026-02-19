import { Resend } from 'resend';

/**
 * Return a Resend client instance. Must be used from server-side code only.
 * This avoids instantiating the client at module-evaluation time (which
 * could accidentally expose the API key if imported from client code).
 */
export function getResend() {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error('RESEND_API_KEY is not configured');
	}
	return new Resend(apiKey);
}
