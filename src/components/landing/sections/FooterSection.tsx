'use client';

const footerLinks = {
  product: [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Use cases', href: '#use-cases' },
  ],
  company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: 'mailto:hello@agathon.app' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
};

export function FooterSection() {
  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      if (href === '#') return;
      const element = document.querySelector(href);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="py-20 px-6 lg:px-16 bg-[#1a1a1a]">
      <div className="max-w-[1200px] mx-auto">
        {/* Top */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-12 mb-20">
          {/* Logo & tagline */}
          <div className="col-span-2 md:col-span-6">
            <img
              src="/logo/agathonwide.png"
              alt="Agathon"
              className="h-6 mb-6"
            />
            <p className="text-[15px] text-white/50 max-w-sm leading-relaxed">
              The AI that teaches you how to think,<br />
              not just what to write.
            </p>
          </div>

          {/* Product */}
          <div className="md:col-span-2">
            <p className="text-[13px] text-white/30 mb-5">Product</p>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => scrollToSection(link.href)}
                    className="text-[14px] text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <p className="text-[13px] text-white/30 mb-5">Company</p>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith('mailto:') ? (
                    <a
                      href={link.href}
                      className="text-[14px] text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <button
                      onClick={() => scrollToSection(link.href)}
                      className="text-[14px] text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-2">
            <p className="text-[13px] text-white/30 mb-5">Legal</p>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[14px] text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-[13px] text-white/30">
            © {new Date().getFullYear()} Agathon
          </p>
          <p className="text-[13px] text-white/30">
            Built for learners, by learners.
          </p>
        </div>
      </div>
    </footer>
  );
}
