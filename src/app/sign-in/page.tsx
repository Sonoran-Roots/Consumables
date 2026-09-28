import { Suspense } from "react";
import SignInForm from "./sign-in-form";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-white p-6">
      <div className="text-center">
        <div className="text-2xl font-black tracking-tight text-black">JARS</div>
        <div className="text-xs font-semibold tracking-[0.2em] text-gray-500">INVENTORY</div>
      </div>
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
