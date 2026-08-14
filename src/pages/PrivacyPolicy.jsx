import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import LandingPageFooter from '../components/landingpage-footer.component.jsx';

const SECTIONS = [
  {
    id: 'collect',
    title: 'Information we collect',
    body: (
      <>
        <p className="mb-4 text-gray-600 leading-relaxed">
          Para PH uses a progressive data collection model. We collect only what is necessary to provide and improve transit services. Depending on your interaction with the platform, we may collect:
        </p>
        <ul className="list-disc space-y-3 pl-5 text-gray-600 marker:text-purple-600">
          <li><span className="font-semibold text-gray-800">Account information.</span> Email address and name during signup, stored in our waitlist database.</li>
          <li><span className="font-semibold text-gray-800">GPS traces.</span> Only during active commute tracking, with explicit consent. Used to build and improve route geometry for public transit routes.</li>
          <li><span className="font-semibold text-gray-800">Commute metrics.</span> Wait times, segment durations, total distance, and ratings collected during tracked commutes.</li>
          <li><span className="font-semibold text-gray-800">Fare confirmations.</span> User feedback on whether displayed fares match actual fares paid.</li>
          <li><span className="font-semibold text-gray-800">Traffic observations.</span> User-reported congestion levels (light/moderate/heavy) per route.</li>
          <li><span className="font-semibold text-gray-800">Route accuracy feedback.</span> Whether the suggested route matched what users actually rode.</li>
          <li><span className="font-semibold text-gray-800">Community contributions.</span> Route edits, votes, POI submissions, and forum posts.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use your information',
    body: (
      <ul className="list-disc space-y-3 pl-5 text-gray-600 marker:text-purple-600">
        <li>Improving route accuracy through crowdsourced GPS traces and corrections.</li>
        <li>Predicting travel times and congestion patterns.</li>
        <li>Validating fare data displayed in route cards.</li>
        <li>Building a comprehensive public transit map of Metro Manila.</li>
        <li>Enhancing platform reliability and user experience.</li>
        <li>Sharing aggregated, anonymized insights with transit planners and policymakers.</li>
      </ul>
    ),
  },
  {
    id: 'not-collect',
    title: 'Data we do NOT collect',
    body: (
      <ul className="list-disc space-y-3 pl-5 text-gray-600 marker:text-purple-600">
        <li>Background location (only during active tracking with consent).</li>
        <li>Raw email addresses in commute logs (identity via secure tokens).</li>
        <li>Financial information (no payments processed through the app).</li>
        <li>Medical, biometric, or health data.</li>
        <li>Personal contacts or device files.</li>
      </ul>
    ),
  },
  {
    id: 'consent',
    title: 'Location tracking consent',
    body: (
      <p className="text-gray-600 leading-relaxed">
        Location tracking <span className="font-semibold">never begins without your explicit consent</span>. When you start a tracked commute or use the "here" feature in chat, you will be prompted to enable location services. You may decline at any time without affecting core app functionality. You can revoke location access through your browser or device settings.
      </p>
    ),
  },
  {
    id: 'sharing',
    title: 'Data sharing',
    body: (
      <>
        <p className="mb-4 text-gray-600 leading-relaxed">We do not sell your personal data. We may share aggregated, anonymized data with:</p>
        <ul className="list-disc space-y-3 pl-5 text-gray-600 marker:text-purple-600">
          <li>Transit agencies and cooperatives for route planning.</li>
          <li>Academic researchers studying Metro Manila mobility.</li>
          <li>Government bodies (LTFRB, DOTr) for policy decisions.</li>
          <li>Platform partners who help operate the service, under confidentiality.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Data security',
    body: (
      <p className="text-gray-600 leading-relaxed">
        We apply organizational, physical, and technical safeguards including encryption and access controls. Data is stored in Supabase (PostgreSQL) with role-based access. Only authorized personnel can access raw data.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'Data retention',
    body: (
      <p className="text-gray-600 leading-relaxed">
        We retain account data while your account is active. GPS traces and commute logs are retained indefinitely to build long-term transit datasets, but are anonymized for analysis. You may request deletion by contacting us.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights under the DPA',
    body: (
      <ul className="list-disc space-y-3 pl-5 text-gray-600 marker:text-purple-600">
        <li>Right to be informed about data collection and use.</li>
        <li>Right to access your personal data.</li>
        <li>Right to correct inaccurate data.</li>
        <li>Right to erasure or blocking in certain circumstances.</li>
        <li>Right to object to processing.</li>
        <li>Right to file a complaint with the National Privacy Commission.</li>
      </ul>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p className="text-gray-600 leading-relaxed">
        For privacy concerns or to exercise your rights, contact our Data Protection Officer at{' '}
        <a href="mailto:para.ph.info@gmail.com" className="font-semibold text-purple-900 hover:text-pink-700 underline-offset-2 hover:underline">para.ph.info@gmail.com</a>.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <article className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8 sm:py-16 lg:py-20 pb-24">
        <h1 className="mt-2 text-5xl font-black tracking-tight text-gray-900 sm:text-4xl">Privacy and data use</h1>
        <p className="mt-2 text-2xl text-gray-500">Last updated: August 15, 2026</p>
        <div className="mt-10 rounded-2xl border border-gray-100 bg-gray-50/80 p-6 sm:p-8">
          <p className="text-gray-700 leading-relaxed">
            Welcome to Para PH. In accordance with the <span className="font-semibold text-gray-900">Data Privacy Act of 2012</span> (Republic Act No. 10173), we are transparent about what we collect and why. This policy covers GPS tracking, commute data, community contributions, and all personal information processed by Para PH.
          </p>
        </div>
        <nav aria-label="On this page" className="mt-10 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-900">On this page</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-purple-900">
            {SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="underline-offset-2 hover:underline">{s.title}</a></li>
            ))}
          </ol>
        </nav>
        <div className="mt-12 space-y-14">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{section.title}</h2>
              <div className="mt-4">{section.body}</div>
            </section>
          ))}
        </div>
      </article>
      <BottomNav />
      <LandingPageFooter />
    </div>
  );
}
