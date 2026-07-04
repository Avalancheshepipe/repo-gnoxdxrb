import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect(redirectTo || "/app/inbox");

  return <AuthForm mode="sign-in" redirectTo={redirectTo || "/app/inbox"} />;
}
