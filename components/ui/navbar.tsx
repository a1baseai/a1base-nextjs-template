"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Home,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Github,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isExternal?: boolean;
}

interface NavLinkProps extends NavItem {}

const NavLink = ({
  href,
  icon,
  label,
  isActive,
  isExternal = false,
}: NavLinkProps) => {
  const linkContent = (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-gray-100/80 ${
        isActive ? "bg-blue-50 font-medium" : ""
      }`}
    >
      <span className={`${isActive ? "text-blue-600" : "text-gray-500"}`}>
        {icon}
      </span>
      <span className={isActive ? "text-blue-600" : "text-gray-700"}>
        {label}
      </span>
    </div>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline"
      >
        {linkContent}
      </a>
    );
  }

  return (
    <Link href={href} className="no-underline">
      {linkContent}
    </Link>
  );
};

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Main navigation items (center)
  const mainNavigation: NavItem[] = [
    {
      href: "/",
      icon: <Home className="h-5 w-5" />,
      label: "Home",
      isActive: pathname === "/",
      isExternal: false,
    },
    {
      href: "/chat",
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Chat",
      isActive: pathname === "/chat",
      isExternal: false,
    },
    {
      href: "/profile-editor",
      icon: <Settings className="h-5 w-5" />,
      label: "Profile Editor",
      isActive: pathname === "/profile-editor",
      isExternal: false,
    },
    {
      href: "/debug",
      icon: <LayoutDashboard className="h-5 w-5" />,
      label: "Debug",
      isActive: pathname === "/debug",
      isExternal: false,
    },
  ];

  // GitHub link (right)
  const githubLink: NavItem = {
    href: "https://github.com/a1baseai/a1framework",
    icon: <Github className="h-5 w-5" />,
    label: "GitHub",
    isActive: false,
    isExternal: true,
  };

  // All navigation items for mobile menu
  const allNavigation = [...mainNavigation, githubLink];

  return (
    <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop layout: 3-column grid with logo left, nav center, github right */}
        <div className="hidden md:grid md:grid-cols-3 items-center h-16">
          {/* Left: Logo */}
          <div className="flex items-center justify-start">
            <Link href="/">
              <Image
                src="/a1base-black.png"
                alt="A1Base Logo"
                width={95}
                height={24}
                className="py-1"
                priority
              />
            </Link>
          </div>

          {/* Center: Main Navigation */}
          <nav className="flex items-center justify-center space-x-2">
            {mainNavigation.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={item.isActive}
                isExternal={item.isExternal}
              />
            ))}
          </nav>

          {/* Right: GitHub link */}
          <div className="flex items-center justify-end">
            <NavLink
              href={githubLink.href}
              icon={githubLink.icon}
              label={githubLink.label}
              isActive={githubLink.isActive}
              isExternal={githubLink.isExternal}
            />
          </div>
        </div>

        {/* Mobile layout */}
        <div className="flex md:hidden justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/">
              <Image
                src="/a1base-black.png"
                alt="A1Base Logo"
                width={90}
                height={22}
                className="py-1"
                priority
              />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-gray-100"
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[240px] sm:w-[300px]">
                <div className="flex items-center justify-between pt-2">
                  <Image
                    src="/a1base-black.png"
                    alt="A1Base Logo"
                    width={80}
                    height={20}
                    className="py-1"
                    priority
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5 text-gray-600" />
                    <span className="sr-only">Close menu</span>
                  </Button>
                </div>
                <div className="mt-8 flex flex-col space-y-2">
                  {allNavigation.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      isActive={item.isActive}
                      isExternal={item.isExternal}
                    />
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
}
