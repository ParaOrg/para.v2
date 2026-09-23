import { Link } from 'react-router-dom';
import paralogo from '../assets/images/Para1P.png';

const FOOTER_LINKS = [
  { to: '/', label: 'Home', locked: false },
  { to: '/about', label: 'About', locked: false },
  { to: '/privacy-policy', label: 'Privacy Policy', locked: false },
  { to: '/explore', label: 'Explore', locked: true },
  { to: '/community', label: 'Community', locked: true },
  { to: '/signup', label: 'Sign Up', locked: false },
];

const DPO_EMAIL = 'para.ph.info@gmail.com';

// __FOOTER_SOCIALS_PATCHED__
const SOCIALS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/para.commute',
    path: 'M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0022 12',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/para.commute/?hl=en',
    path: 'M7.75 2h8.5A5.75 5.75 0 0122 7.75v8.5A5.75 5.75 0 0116.25 22h-8.5A5.75 5.75 0 012 16.25v-8.5A5.75 5.75 0 017.75 2zm0 1.8A3.95 3.95 0 003.8 7.75v8.5a3.95 3.95 0 003.95 3.95h8.5a3.95 3.95 0 003.95-3.95v-8.5a3.95 3.95 0 00-3.95-3.95h-8.5zm8.85 1.55a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zM12 7.4a4.6 4.6 0 110 9.2 4.6 4.6 0 010-9.2zm0 1.8a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6z',
  },
  {
    label: 'X',
    href: 'https://x.com/para_commute',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@para.commute',
    path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z',
  },
];

export default function LandingPageFooter({ className = '' }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`border-t border-gray-200 bg-gray-50 text-gray-600 ${className}`}
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-6 py-12 sm:px-8 lg:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2">
              <img src={paralogo} alt="" className="h-10 w-auto object-contain" width={120} height={40} />
              <span className="sr-only">Para PH home</span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed sm:text-base">
              Metro Manila&rsquo;s commute companion: community-first routes, transit context, and tools built for commuters and partners.
            </p>
            <p className="mt-4 text-sm">
              <span className="font-semibold text-gray-800">Data protection:</span>{' '}
              <a
                href={`mailto:${DPO_EMAIL}`}
                className="text-purple-900 underline decoration-purple-900/30 underline-offset-2 hover:text-pink-700"
              >
                {DPO_EMAIL}
              </a>
            </p>

            {/* __FOOTER_SOCIALS_PATCHED__ social icons */}
            <div className="mt-6 flex items-center gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 transition-colors hover:border-purple-500 hover:text-purple-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <nav aria-labelledby="footer-explore-heading" className="min-w-0">
            <h2 id="footer-explore-heading" className="text-xs font-bold uppercase tracking-wider text-gray-900">
              Explore
            </h2>
            <ul className="mt-4 space-y-3">
              {FOOTER_LINKS.map(({ to, label, locked }) => (
                <li key={to}>
                  {locked ? (
                    <Link
                      to="/signup"
                      className="text-sm font-medium text-gray-500 hover:text-purple-900 focus:outline-none focus-visible:text-purple-900 focus-visible:underline rounded-sm"
                    >
                      {label} <span className="text-[10px] text-gray-400 ml-1">🔒</span>
                    </Link>
                  ) : (
                    <Link
                      to={to}
                      className="text-sm font-medium text-gray-700 hover:text-purple-900 focus:outline-none focus-visible:text-purple-900 focus-visible:underline rounded-sm"
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal-heading" className="min-w-0">
            <h2 id="footer-legal-heading" className="text-xs font-bold uppercase tracking-wider text-gray-900">
              Legal
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-sm font-medium text-gray-700 hover:text-purple-900 focus:outline-none focus-visible:text-purple-900 focus-visible:underline rounded-sm"
                >
                  Privacy policy
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-gray-200 pt-8 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
          <p>
            &copy; {year} Para PH. All rights reserved.
          </p>
          <p className="max-w-prose leading-relaxed">
            We process personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173). See our{' '}
            <Link to="/privacy-policy" className="font-medium text-purple-900 hover:text-pink-700 underline-offset-2 hover:underline">
              privacy policy
            </Link>
            {' '}for details.
          </p>
        </div>
      </div>
    </footer>
  );
}
