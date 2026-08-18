import {
  Button,
  buttonVariants,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@remora/ui";
import { MenuIcon } from "lucide-react";

import { Link } from "@tanstack/react-router";

export function LandingNavigation({
  activeItem,
  showBrand = true,
}: {
  activeItem?: "pricing";
  showBrand?: boolean;
} = {}) {
  return (
    <header className="mx-auto w-full max-w-7xl pb-6">
      <nav
        aria-label="Primary"
        className={
          showBrand
            ? "flex items-center justify-between"
            : "flex items-center justify-end"
        }
      >
        {showBrand ? (
          <a
            href="/"
            aria-label="Remora home"
            className="rounded-sm focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
          >
            <img
              src="/remora-wordmark.svg"
              alt="Remora"
              className="h-auto w-27 select-none"
              draggable={false}
            />
          </a>
        ) : null}
        <div className="hidden items-center gap-4 sm:flex">
          <a
            aria-current={activeItem === "pricing" ? "page" : undefined}
            href="/pricing"
            className={
              activeItem === "pricing"
                ? "rounded-sm text-sm text-[#f7f3eb] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
                : "rounded-sm text-sm text-[#a7a59f] transition-colors hover:text-[#f7f3eb] focus-visible:text-[#f7f3eb] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
            }
          >
            Pricing
          </a>
          <Link className={buttonVariants()} to="/sign-up">
            Get Started
          </Link>
        </div>
        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Open navigation menu"
                  className="text-[#f7f3eb] hover:bg-white/10 focus-visible:ring-[#8da0dc]"
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <MenuIcon />
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              className="w-48 bg-[#1b1c1c] text-[#f7f3eb] ring-white/10 sm:hidden"
              sideOffset={8}
            >
              <DropdownMenuItem
                className="px-3 py-2 text-sm"
                render={
                  <a
                    aria-current={activeItem === "pricing" ? "page" : undefined}
                    href="/pricing"
                  />
                }
              >
                Pricing
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="px-3 py-2 text-sm"
                render={<Link to="/sign-up">Get Started</Link>}
              >
                Get Started
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
