"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SafetyEditorRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new location under profile editor
    router.push('/profile-editor/safety-editor');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p>The Safety Settings page has moved to Profile Editor.</p>
        <div className="mt-4 animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
      </div>
    </div>
  );
}
