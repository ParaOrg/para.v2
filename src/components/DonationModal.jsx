import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const TABS = [
  { id: 'gcash', label: 'GCash', image: '/donate-qr-gcash.JPG' },
  { id: 'bank', label: 'Bank (QR Ph)', image: '/donate-qr-bank.JPG' },
];

export default function DonationModal({ open, onClose }) {
  const [tab, setTab] = useState('gcash');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText('Gabriel Camilo Cascolan');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#381D65]">Support Para PH 💜</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Your donations will go towards maintaining the website, adding features,
            developing the app versions, and giving the team access to expand and verify
            its data sources across the Philippines. Any excess will go towards
            supporting the drivers and other community members in need.
          </p>

          <div className="mt-5 flex items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 rounded-full text-xs font-bold border transition-colors ${
                  tab === t.id
                    ? 'bg-[#7A4BC8] text-white border-[#7A4BC8]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#7A4BC8] hover:text-[#7A4BC8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-center">
            <div className="w-full max-w-[280px] aspect-square bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={TABS.find((t) => t.id === tab).image}
                alt={`${tab} QR code`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="mt-3 text-xs text-gray-500 text-center">
              Open your PH bank or e-wallet app and tap <span className="font-bold">Scan QR</span>.
            </p>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-1">
              Account name
            </p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#381D65]">
                Gabriel Camilo Cascolan | PARA PH
              </span>
              <button
                onClick={copyName}
                className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-full bg-purple-50 text-[#7A4BC8] hover:bg-purple-100 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="mt-5 text-xs text-gray-500 text-center">
            Questions?{' '}
            <a
              href="mailto:para.ph.info@gmail.com"
              className="text-[#7A4BC8] underline font-semibold"
            >
              para.ph.info@gmail.com
            </a>
          </p>

          <p className="mt-4 text-[11px] text-gray-400 text-center leading-relaxed">
            Salamat sa suporta! Every peso keeps Para PH free and community-powered.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
