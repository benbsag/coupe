import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { SignInPanel } from "@/components/sign-in-panel";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { callbackUrl } = await searchParams;

  async function signInAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    await signIn("resend", {
      email,
      redirectTo: callbackUrl && callbackUrl !== "/sign-in" ? callbackUrl : "/",
    });
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <SignInPanel action={signInAction} />
    </main>
  );
}
