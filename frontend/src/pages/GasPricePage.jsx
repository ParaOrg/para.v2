import { lazy, Suspense, useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useGasPrices } from '../components/GasPrice/useGasPrices';
import ReportModal from '../components/GasPrice/ReportModal';
import { getGoogleMapsApiKey } from '../config/googleMaps';

const GasStationMap = lazy(() => import('../components/GasPrice/GasStationMap'));

const MAPS_API_KEY = getGoogleMapsApiKey();

const FUEL_ROWS = [
  { id: 'ron91',          label: 'Gasoline RON 91', badge: 'RON 91'  },
  { id: 'ron95',          label: 'Gasoline RON 95', badge: 'RON 95'  },
  { id: 'ron97',          label: 'Gasoline RON 97', badge: 'RON 97'  },
  { id: 'xcs',            label: 'Petron XCS',      badge: 'XCS'     },
  { id: 'diesel',         label: 'Diesel (Common)', badge: 'Diesel'  },
  { id: 'diesel_premium', label: 'Diesel Premium',  badge: 'Premium' },
  { id: 'kerosene',       label: 'Kerosene',        badge: 'Kero'    },
];

const REPORT_CTA_CLASS =
  'inline-flex items-center gap-2.5 rounded-full border border-pink-200 bg-white px-3.5 py-2 text-pink-700 shadow-sm hover:bg-pink-50 hover:border-pink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 transition-colors';

function ChangeChip({ price, prev }) {
  if (price == null || prev == null) return null;
  const diff = +(price - prev).toFixed(2);
  if (diff === 0) return <span className="text-xs text-gray-400 ml-1">—</span>;
  if (diff < 0)   return <span className="text-xs text-green-600 ml-1 font-medium">↓ {Math.abs(diff).toFixed(2)}</span>;
  return              <span className="text-xs text-red-500  ml-1 font-medium">↑ {diff.toFixed(2)}</span>;
}

function StaleDataBanner({ ageDays }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center">
      <p className="text-xs sm:text-sm text-amber-800">
        ⚠️ Brand price data is <strong>{ageDays} days old</strong> — our source hasn't published an update recently.
        DOE's own weekly range below is still current; individual brand prices may have moved since.
      </p>
    </div>
  );
}

function DoeSummaryLine({ summary }) {
  if (!summary || !summary.gasoline_direction) return null;
  const arrow = (dir) => (dir === 'increase' ? '↑' : dir === 'decrease' ? '↓' : '—');
  const parts = [
    summary.gasoline_change_min != null && `Gasoline ${arrow(summary.gasoline_direction)} ₱${summary.gasoline_change_min.toFixed(2)}–${summary.gasoline_change_max.toFixed(2)}/L`,
    summary.diesel_change_min != null && `Diesel ${arrow(summary.diesel_direction)} ₱${summary.diesel_change_min.toFixed(2)}–${summary.diesel_change_max.toFixed(2)}/L`,
    summary.kerosene_change_min != null && `Kerosene ${arrow(summary.kerosene_direction)} ₱${summary.kerosene_change_min.toFixed(2)}–${summary.kerosene_change_max.toFixed(2)}/L`,
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <p className="text-xs text-gray-400 mt-1">
      DOE Oil Monitor, effective {summary.effective_start}–{summary.effective_end}: {parts.join(' · ')}
    </p>
  );
}

function NewsCitation({ news }) {
  const item = news?.[0];
  if (!item) return null;
  const directionLabel = item.direction === 'rollback' ? '↓ Rollback' : item.direction === 'hike' ? '↑ Hike' : 'Fuel news';

  return (
    <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800 mb-2">In the News</h2>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 group no-underline"
      >
        <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${item.direction === 'rollback' ? 'bg-green-50 text-green-700' : item.direction === 'hike' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
          {directionLabel}
        </span>
        <span className="text-sm text-gray-700 group-hover:text-pink-600 transition-colors">
          {item.title}
          {item.published_at && <span className="text-gray-400"> · {item.published_at}</span>}
        </span>
      </a>
    </section>
  );
}

function PriceTagIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 012-2h6l10 10a2 2 0 010 2.83l-3.17 3.17a2 2 0 01-2.83 0L5 11V7z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M13 12h4" />
    </svg>
  );
}

function SummaryCard({ item }) {
  const diff = +(item.price - item.prev_price).toFixed(2);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{item.label}</p>
      <p className="text-3xl font-bold text-gray-900">₱{item.price.toFixed(2)}</p>
      <p className="text-xs text-gray-400">per liter</p>
      <div className="mt-1">
        {diff < 0 && <span className="inline-flex items-center gap-1 text-sm text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">↓ ₱{Math.abs(diff).toFixed(2)} this week</span>}
        {diff > 0 && <span className="inline-flex items-center gap-1 text-sm text-red-500  font-semibold bg-red-50   px-2 py-0.5 rounded-full">↑ ₱{diff.toFixed(2)} this week</span>}
        {diff === 0 && <span className="inline-flex items-center gap-1 text-sm text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">No change</span>}
      </div>
    </div>
  );
}

// ── Near-station banner — compact single row on all screen sizes ──────────────
function NearStationBanner({ coords, onReport }) {

  return (
    <div className="sticky top-0 z-40 bg-pink-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 shadow-[0_8px_18px_rgba(219,39,119,0.32)] border-b border-pink-500">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight truncate">
          {coords ? 'Near a gas station? Help the community!' : 'Help the community with live fuel prices!'}
        </p>
        <p className="text-pink-100 text-xs mt-0.5 hidden sm:block">
          {coords
            ? 'Report the price you see at the pump — no account needed.'
            : 'You can report from anywhere — no account needed.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onReport(coords)}
        className={`shrink-0 ${REPORT_CTA_CLASS}`}
        aria-label="Open report fuel price form"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pink-100 text-pink-600">
          <PriceTagIcon className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold leading-none">Report fuel price</span>
        <span className="text-sm text-pink-400" aria-hidden>→</span>
      </button>
    </div>
  );
}

export default function GasPricePage() {
  const { data, loading, error } = useGasPrices();
  const [modalOpen, setModalOpen]   = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const inMetroManila =
          coords.latitude >= 14.35 && coords.latitude <= 14.85 &&
          coords.longitude >= 120.75 && coords.longitude <= 121.15;

        if (inMetroManila) {
          setUserCoords({ lat: coords.latitude, lng: coords.longitude });
        }
      },
      () => {},
      { timeout: 5000, maximumAge: 300_000 }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-red-500">Failed to load fuel prices. Is the backend running?</p>
      </div>
    );
  }

  const isCommunityBlended = data.source?.includes('Community');

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <div className="min-h-screen bg-gray-50">

        {/* Near-station CTA */}
        <NearStationBanner
          coords={userCoords}
          onReport={(coords) => {
            setUserCoords(coords ?? null);
            setModalOpen(true);
          }}
        />

        {/* Hero */}
        {data.stale && <StaleDataBanner ageDays={data.data_age_days} />}
        <div className="bg-white border-b border-gray-100 px-6 py-10 text-center">
          <span className="inline-block text-4xl mb-3">⛽</span>
          <h1 className="text-3xl font-bold text-gray-900">Fuel Prices Philippines</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Metro Manila average pump prices ·{' '}
            {isCommunityBlended
              ? <span className="inline-flex items-center gap-1">DOE + Community Reports <span className="bg-pink-100 text-pink-700 text-xs font-semibold px-2 py-0.5 rounded-full">Live</span></span>
              : 'DOE Oil Monitor'
            }
            {' '}· <span className="font-medium text-gray-700">as of {data.last_updated}</span>
          </p>
          <DoeSummaryLine summary={data.doe_summary} />
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
          {data.news?.length > 0 && <NewsCitation news={data.news} />}

          {/* Summary cards */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Average Pump Prices</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.averages.map(a => <SummaryCard key={a.id} item={a} />)}
            </div>
          </section>

          {/* Comparison table */}
          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Compare Pump Prices by Brand</h2>
            <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-100 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-4 font-semibold text-gray-500 w-36">Fuel Type</th>
                    <th className="px-4 py-4 font-semibold text-gray-500 text-center">
                      <span className="text-xs uppercase tracking-wider">Average</span>
                    </th>
                    {data.stations.map(s => (
                      <th key={s.id} className="px-4 py-4 text-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold"
                          style={{ backgroundColor: s.color }}
                        >
                          <img src={`/logos/${s.id}.svg`} alt="" className="w-4 h-4 object-contain" />
                          {s.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FUEL_ROWS.map((row, i) => {
                    const avg = data.averages.find(a => a.id === row.id);
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-pink-50/30 transition-colors`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-800">{row.label}</div>
                          <div className="text-xs text-gray-400">{row.badge}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {avg ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-pink-600">₱{avg.price.toFixed(2)}</span>
                              <ChangeChip price={avg.price} prev={avg.prev_price} />
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        {data.stations.map(station => {
                          const entry = station.prices[row.id];
                          return (
                            <td key={station.id} className="px-4 py-4 text-center">
                              {entry ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="font-semibold text-gray-800">
                                    ₱{entry.price.toFixed(2)}
                                    {entry.source === 'community' && (
                                      <span className="ml-1 text-xs text-pink-500" title="Community reported">●</span>
                                    )}
                                  </span>
                                  <ChangeChip price={entry.price} prev={entry.prev_price} />
                                </div>
                              ) : (
                                <span className="text-gray-300 text-base">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-right">
              Prices in ₱/liter · Changes vs. previous week · <span className="text-pink-500">●</span> Community reported · Source: DOE Philippines
            </p>
          </section>
          
          {/* Station map */}
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-700">Find Stations Near You</h2>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className={REPORT_CTA_CLASS}
                aria-label="Report fuel price"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                  <PriceTagIcon className="h-4 w-4" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-pink-500">Community</span>
                  <span className="block text-sm font-semibold text-pink-700">Submit Price Report</span>
                </span>
              </button>
            </div>

            <div>
              <Suspense fallback={
                <div className="h-96 flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }>
                <GasStationMap />
              </Suspense>
            </div>
          </section>

          {/* Community pricing callout */}
          <section className="bg-pink-50 rounded-2xl p-6 border border-pink-100">
            <h2 className="text-base font-semibold text-pink-800 mb-2">Community Price Reports</h2>
            <p className="text-sm text-pink-700 leading-relaxed">
              Prices are sourced from the DOE Philippines and updated weekly. Click any station on the map
              to view community-reported pump prices and submit your own — no account required. Community
              averages replace DOE data once <strong>3 or more reports</strong> are received within 7 days.
              Cells marked <span className="text-pink-500 font-bold">●</span> in the table above reflect community reports.
            </p>
          </section>

          <p className="text-center text-xs text-gray-400 pb-8">
            Data from the Department of Energy (DOE) Philippines · Updated weekly every Monday
          </p>
        </div>
      </div>

      {/* Report modal — rendered inside APIProvider so useMapsLibrary works */}
      <ReportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        coords={userCoords}
      />
    </APIProvider>
  );
}
