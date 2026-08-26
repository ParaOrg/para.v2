import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuccessModal({ show, message, subtitle, onClose }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 15 }}
            className="bg-white rounded-[24px] p-8 mx-4 max-w-sm w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-[20px] font-bold text-[#381D65] font-poppins mb-2">
              {message || 'Saved Successfully!'}
            </h2>
            {subtitle && (
              <p className="text-[13px] text-gray-500 font-poppins mb-5">
                {subtitle}
              </p>
            )}
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-[#7A4BC8] text-white rounded-[14px] text-[15px] font-bold font-poppins shadow-lg"
            >
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
