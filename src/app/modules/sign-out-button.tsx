"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/sign-in");
              router.refresh();
            },
          },
        })
      }
      className="text-sm text-gray-500 hover:text-gray-800 hover:underline"
    >
      Sign out
    </button>
  );
}
