import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { openAppSettings } from '../utils/nativeTracker';

// __OEM_ONBOARDING_V1__

interface OemInfo {
  brand: string;
  steps: string[];
  autoStartPath?: string;
}

function detectOem(): OemInfo | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();

  if (/miu|xiaomi|redmi|poco/.test(ua)) {
    return {
      brand: 'Xiaomi / Redmi / POCO (MIUI)',
      steps: [
        'Open Settings -> Apps -> Manage apps -> Para PH Tracker',
        'Tap "Autostart" and enable it',
        'Tap "Battery saver" and set to "No restrictions"',
        'Tap "Other permissions" and enable "Display pop-up windows"',
        'Go back to Settings -> Battery -> App battery saver -> Para PH Tracker',
        'Select "No restrictions"',
      ],
    };
  }

  if (/oppo|realme|coloros/.test(ua)) {
    return {
      brand: 'OPPO / Realme (ColorOS)',
      steps: [
        'Open Settings -> Battery -> App Battery Management',
        'Find "Para PH Tracker" and enable "Allow background running"',
        'Disable "Smart power saving" for this app',
        'Go to Settings -> Privacy -> Startup Manager',
        'Enable "Para PH Tracker" in the list',
      ],
    };
  }

  if (/vivo|iqoo|funtouch/.test(ua)) {
    return {
      brand: 'Vivo / iQOO (Funtouch)',
      steps: [
        'Open Settings -> Battery -> High background power consumption',
        'Enable "Para PH Tracker"',
        'Go to Settings -> Battery -> Background power consumption management',
        'Set "Para PH Tracker" to "Allow"',
        'Open iManager -> App Manager -> Autostart Manager',
        'Enable "Para PH Tracker"',
      ],
    };
  }

  if (/samsung|sm-/.test(ua)) {
    return {
      brand: 'Samsung (One UI)',
      steps: [
        'Open Settings -> Apps -> Para PH Tracker -> Battery',
        'Select "Unrestricted"',
        'Open Settings -> Battery and device care -> Battery',
        'Tap "Background usage limits"',
        'Make sure Para PH Tracker is NOT in "Sleeping apps" or "Deep sleeping apps"',
      ],
    };
  }

  if (/huawei|honor/.test(ua)) {
    return {
      brand: 'Huawei / Honor (EMUI)',
      steps: [
        'Open Settings -> Battery -> App launch',
        'Find "Para PH Tracker" and set to "Manage manually"',
        'Enable all three toggles: Auto-launch, Secondary launch, Run in background',
      ],
    };
  }

  return {
    brand: 'Android',
    steps: [
      'Open Settings -> Apps -> Para PH Tracker -> Battery',
      'Select "Unrestricted" or "Not optimized"',
      'This prevents Android from killing the tracker mid-commute.',
    ],
  };
}

const STORAGE_KEY = 'para.oemOnboardingShown';

export default function OemBatteryOnboarding() {
  const [visible, setVisible] = useState(false);
  const [oem, setOem] = useState<OemInfo | null>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* private mode */
    }
    const info = detectOem();
    setOem(info);
    setVisible(true);
  }, []);

  if (!visible || !oem) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[700] bg-black/60 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-black text-[#381D65] mb-2">
          Keep the tracker alive
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Your phone is a <strong>{oem.brand}</strong>. Android may kill
          background tracking unless you whitelist Para PH Tracker. This is
          a one-time setup.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-800 mb-4">
          {oem.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="flex gap-3">
          <button
            onClick={() => { openAppSettings().catch(() => {}); }}
            className="flex-1 bg-[#381D65] text-white rounded-full py-3 text-sm font-bold"
          >
            Open Settings
          </button>
          <button
            onClick={dismiss}
            className="flex-1 bg-gray-100 text-gray-800 rounded-full py-3 text-sm font-bold"
          >
            I did it
          </button>
        </div>
        <button
          onClick={dismiss}
          className="w-full mt-3 text-xs text-gray-400"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
