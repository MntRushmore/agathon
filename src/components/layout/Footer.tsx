'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E8E4DC] bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1a1a1a]">Agathon</span>
            <span className="text-[#999] text-sm">
              &copy; {currentYear}
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-[#666] hover:text-[#1a1a1a] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[#666] hover:text-[#1a1a1a] transition-colors"
            >
              Terms
            </Link>
            <a
              href="mailto:support@agathon.app"
              className="text-[#666] hover:text-[#1a1a1a] transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
