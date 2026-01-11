import { motion, type HTMLMotionProps } from 'framer-motion';

type WoodenButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'wood' | 'red' | 'white';
  children: React.ReactNode;
};

export default function WoodenButton({ variant = 'wood', children, className, ...props }: WoodenButtonProps) {
  
  // Base wood style
  let bgClass = 'bg-[#8B5A2B]';
  let borderClass = 'border-[#4A2C1D]';
  let textClass = 'text-[#2e1a0f]';
  let shadowClass = 'shadow-[0_4px_0_#4A2C1D]';
  
  // Wood grain gradient effect
  const woodGrain = {
    backgroundImage: `
      repeating-linear-gradient(
        45deg,
        rgba(0,0,0,0.05) 0px,
        rgba(0,0,0,0.05) 2px,
        transparent 2px,
        transparent 4px
      ),
      linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(0,0,0,0.1))
    `
  };

  if (variant === 'red') {
    bgClass = 'bg-red-600';
    borderClass = 'border-red-900';
    textClass = 'text-white';
    shadowClass = 'shadow-[0_4px_0_#7f1d1d]';
  } else if (variant === 'white') {
    bgClass = 'bg-[#F0E6D2]';
    borderClass = 'border-[#8B5A2B]';
    textClass = 'text-[#4A2C1D]';
    shadowClass = 'shadow-[0_4px_0_#8B5A2B]';
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.98, y: 2 }}
      className={`
        relative px-8 py-4 font-bold text-2xl uppercase tracking-wider 
        flex items-center justify-center 
        rounded-xl border-b-4 border-r-4 ${borderClass}
        ${bgClass} ${textClass} ${shadowClass}
        ${className}
      `}
      style={woodGrain}
      {...props}
    >
      {/* Screw heads */}
      <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-black/20 shadow-inner"></div>
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-black/20 shadow-inner"></div>
      <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-black/20 shadow-inner"></div>
      <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-black/20 shadow-inner"></div>
      
      <span className="relative z-10 drop-shadow-sm">{children}</span>
    </motion.button>
  );
}
