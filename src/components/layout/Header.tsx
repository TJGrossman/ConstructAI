"use client";

import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium">{session?.user?.name}</p>
          <p className="text-xs text-muted-foreground">
            {session?.user?.email}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
