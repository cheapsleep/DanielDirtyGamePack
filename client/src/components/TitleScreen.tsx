import { motion } from 'framer-motion';

interface TitleScreenProps {
  onContinue: () => void;
}

export default function TitleScreen({ onContinue }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 prehistoric-bg flex items-center justify-center z-40">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-3xl p-8 text-center"
      >
        <motion.img
          layoutId="app-logo"
          src="/assets/TITLE_LOGO.svg"
          alt="DanielBox Party Games"
          className="w-3/4 mx-auto h-auto drop-shadow-2xl"
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-6"
        >
          <button
            onClick={onContinue}
            className="px-8 py-3 rounded-full bg-amber-400 text-slate-900 font-bold shadow-lg hover:scale-105 transition-transform"
          >
            START
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
