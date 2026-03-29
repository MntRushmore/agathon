import { type NextRequest, NextResponse } from "next/server";
import { getConnectionStatus, type KnowledgeProvider } from "@/lib/composio";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
	const redirect = req.nextUrl.searchParams.get("redirect");
	let redirectPath = "/knowledge";
	if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
		redirectPath = redirect;
	}
	const separator = redirectPath.includes("?") ? "&" : "?";

	try {
		const supabase = await createServerSupabaseClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		const provider = req.nextUrl.searchParams.get(
			"provider",
		) as KnowledgeProvider;

		if (!user) {
			return NextResponse.redirect(`${siteUrl}/login`);
		}

		if (!provider) {
			return NextResponse.redirect(
				`${siteUrl}/knowledge?error=missing_provider`,
			);
		}

		// Verify the connection actually succeeded on the Composio side
		// Composio may not have indexed the connection immediately after OAuth redirect,
		// so retry a few times with a delay before giving up.
		let connection = await getConnectionStatus(user.id, provider);
		if (!connection) {
			for (let attempt = 1; attempt <= 3; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				connection = await getConnectionStatus(user.id, provider);
				if (connection) break;
			}
		}
		if (!connection) {
			// OAuth was cancelled or failed — mark as failed and redirect with error
			await supabase
				.from("connected_accounts")
				.update({ status: "failed" })
				.eq("user_id", user.id)
				.eq("provider", provider);

			return NextResponse.redirect(
				`${siteUrl}${redirectPath}${separator}error=connection_failed`,
			);
		}

		// Connection verified — mark as active
		await supabase
			.from("connected_accounts")
			.update({
				status: "active",
				connected_at: new Date().toISOString(),
			})
			.eq("user_id", user.id)
			.eq("provider", provider);

		return NextResponse.redirect(
			`${siteUrl}${redirectPath}${separator}connected=${provider}`,
		);
	} catch (error) {
		console.error("Knowledge callback error:", error);
		return NextResponse.redirect(
			`${siteUrl}${redirectPath}${separator}error=callback_failed`,
		);
	}
}
