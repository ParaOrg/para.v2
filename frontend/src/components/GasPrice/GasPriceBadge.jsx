import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useGasPrices } from './useGasPrices';

export default function GasPriceBadge({ compact = false, className = '' }) {
  const { data, loading } = useGasPrices();

  const tickerItems = useMemo(() => {
    const priority = ['ron95', 'diesel', 'ron91', 'ron97', 'diesel_premium'];
    const averages = Array.isArray(data?.averages) ? data.averages : [];

    return priority
      .map((id) => averages.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, compact ? 3 : 4);
  }, [compact, data]);

  const repeatedItems = tickerItems.length > 1 ? [...tickerItems, ...tickerItems] : tickerItems;

  const formatLabel = (item) => item.short ?? item.label ?? item.id?.toUpperCase?.() ?? item.id;
  const formatChange = (item) => {
    const change = Number(item.price) - Number(item.prev_price ?? item.price ?? 0);
    if (!Number.isFinite(change) || change === 0) return '0.00';
    return `${change > 0 ? '+' : ''}${change.toFixed(2)}`;
  };

  const showTicker = !loading && tickerItems.length > 0;

  return (
    <Link
      to="/gas-prices"
      className={`group flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-sm no-underline shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-300 hover:bg-pink-50 ${className}`}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-pink-50 shadow-inner ${compact ? 'h-7 w-7 text-sm' : 'h-8 w-8 text-base'}`}>
        ⛽
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 ${compact ? 'hidden xl:inline' : 'hidden sm:inline'}`}>
          Live
        </span>

        {showTicker ? (
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <style>{`
              @keyframes gasTickerScroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
            <div className="flex w-max items-center gap-3 pr-8 will-change-transform motion-reduce:animate-none group-hover:[animation-play-state:paused]" style={{ animation: `gasTickerScroll ${compact ? 13 : 18}s linear infinite` }}>
              {repeatedItems.map((item, index) => {
                const change = Number(item.price) - Number(item.prev_price ?? item.price ?? 0);
                const isUp = change > 0;
                const isDown = change < 0;

                return (
                  <div key={`${item.id}-${index}`} className="inline-flex shrink-0 items-center gap-2">
                    <span className="font-semibold text-gray-700">{formatLabel(item)}</span>
                    <span className="font-bold text-pink-600">₱{Number(item.price).toFixed(2)}</span>
                    <span className={`text-[11px] font-semibold ${isDown ? 'text-green-600' : isUp ? 'text-red-500' : 'text-gray-400'}`}>
                      {isDown ? '↓' : isUp ? '↑' : '•'} {formatChange(item)}
                    </span>
                    <span className="text-gray-300" aria-hidden>•</span>
                  </div>
                );
              })}
            </div>
          </div>
      ) : (
          <span className="text-xs text-gray-400">Loading prices...</span>
      )}
      </div>
    </Link>
  );
}
