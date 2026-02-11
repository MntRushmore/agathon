'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#e2e4e8] bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Agathon</span>
            <span className="text-[#9ca3af] text-sm">
              &copy; {currentYear}
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-[#6b7280] hover:text-[#007ba5] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[#6b7280] hover:text-[#007ba5] transition-colors"
            >
              Terms
            </Link>
            <a
              href="mailto:hello@agathon.app"
              className="text-[#6b7280] hover:text-[#007ba5] transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
