'use client';

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavbar = pathname === '/data-viewer' || pathname.startsWith('/chat/');

  return (
    <>
      {!hideNavbar && <Navbar />}
      <main className={`${hideNavbar ? 'min-h-screen' : 'min-h-[calc(100vh-64px)]'} w-full overflow-x-hidden`}>
        {children}
      </main>
    </>
  );
} 