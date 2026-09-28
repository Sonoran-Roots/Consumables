import Link from "next/link";
import SignUpForm from "./sign-up-form";

export const dynamic = "force-dynamic";

// TEMPORARY — bootstrap-only. Once real accounts exist, set
// disableSignUp: true in src/lib/auth.ts and delete this whole folder.
// There's no self-serve registration need for an internal tool, and
// leaving this open is an open door on a public URL.
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-white p-6">
      <div className="text-center">
        <div className="text-2xl font-black tracking-tight text-black">JARS</div>
        <div className="text-xs font-semibold tracking-[0.2em] text-gray-500">INVENTORY</div>
      </div>
      <SignUpForm />
      <Link href="/sign-in" className="text-sm text-gray-500 hover:underline">
        Already have an account? Sign in
      </Link>
    </div>
  );
}
