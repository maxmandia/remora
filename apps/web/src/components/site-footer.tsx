const footerLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/models", label: "Models" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl shrink-0 border-t border-white/10 pt-5 text-xs text-[#8f8e89] sm:pt-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Remora</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <a
                  className="rounded-sm transition-colors hover:text-[#f7f3eb] focus-visible:text-[#f7f3eb] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
