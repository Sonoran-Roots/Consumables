import { Suspense } from "react";
import Link from "next/link";
import SignInForm from "./sign-in-form";
import JarsLogo from "@/components/jars-logo";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-white p-6">
      <div className="flex flex-col items-center text-center">
        <JarsLogo size={96} className="mb-4" />
        <div className="text-2xl font-black tracking-tight text-black">
          JARS Cannabis Arizona
        </div>
        <div className="text-xs font-semibold tracking-[0.2em] text-gray-500">
          CONSUMABLE MANAGEMENT
        </div>
      </div>
      <Suspense>
        <SignInForm />
      </Suspense>
      <Link href="/sign-up" className="text-sm text-gray-500 hover:underline">
        Need an account? Create one
      </Link>
    </div>
  );
}
