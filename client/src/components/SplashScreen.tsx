import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4000); // Show splash for 4 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 1.5 }}
        transition={{ duration: 1, type: "spring", bounce: 0.5 }}
        className="w-full max-w-2xl p-8"
      >
        <img 
          src="/assets/TITLE_LOGO.svg" 
          alt="DanielBox Party Games" 
          className="w-full h-auto drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
        />
        <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="text-center text-white mt-8 text-2xl font-bold tracking-widest"
        >
            LOADING THE FUN...
        </motion.p>
      </motion.div>
    </div>
  );
}
