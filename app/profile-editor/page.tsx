"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfileEditorRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to profile settings page
    router.push("/profile-editor/profile-settings");
  }, [router]);

  // Show loading indicator while redirecting
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
    </div>
  );
}
