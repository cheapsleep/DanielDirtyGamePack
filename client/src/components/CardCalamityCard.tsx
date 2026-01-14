import { motion } from 'framer-motion';

export type CCColor = 'red' | 'blue' | 'green' | 'yellow';
export type CCCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface CCCard {
  id: string;
  color: CCColor | null;
  type: CCCardType;
  value?: number;
}

interface CardCalamityCardProps {
  card: CCCard;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
  className?: string;
}

const colorClasses: Record<CCColor, { bg: string; border: string; gradient: string }> = {
  red: {
    bg: 'bg-red-500',
    border: 'border-red-700',
    gradient: 'from-red-400 via-red-500 to-red-600'
  },
  blue: {
    bg: 'bg-blue-500',
    border: 'border-blue-700',
    gradient: 'from-blue-400 via-blue-500 to-blue-600'
  },
  green: {
    bg: 'bg-green-500',
    border: 'border-green-700',
    gradient: 'from-green-400 via-green-500 to-green-600'
  },
  yellow: {
    bg: 'bg-yellow-400',
    border: 'border-yellow-600',
    gradient: 'from-yellow-300 via-yellow-400 to-yellow-500'
  }
};

const getCardContent = (card: CCCard): { symbol: string; text: string } => {
  switch (card.type) {
    case 'number':
      return { symbol: String(card.value ?? 0), text: String(card.value ?? 0) };
    case 'skip':
      return { symbol: '🚫', text: 'SKIP' };
    case 'reverse':
      return { symbol: '🔄', text: 'REV' };
    case 'draw2':
      return { symbol: '+2', text: '+2' };
    case 'wild':
      return { symbol: '🌈', text: 'WILD' };
    case 'wild4':
      return { symbol: '+4', text: '+4' };
    default:
      return { symbol: '?', text: '?' };
  }
};

export default function CardCalamityCard({
  card,
  onClick,
  disabled = false,
  selected = false,
  small = false,
  faceDown = false,
  className = ''
}: CardCalamityCardProps) {
  const content = getCardContent(card);
  const isWild = card.type === 'wild' || card.type === 'wild4';
  
  const sizeClasses = small 
    ? 'w-12 h-18 text-xs' 
    : 'w-20 h-28 sm:w-24 sm:h-36';
  
  const cornerSize = small ? 'text-[8px]' : 'text-xs sm:text-sm';
  const centerSize = small ? 'text-lg' : 'text-3xl sm:text-4xl';
  
  if (faceDown) {
    return (
      <motion.div
        className={`${sizeClasses} rounded-xl border-4 border-slate-600 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 shadow-lg flex items-center justify-center ${className}`}
        whileHover={onClick ? { scale: 1.05 } : {}}
        whileTap={onClick ? { scale: 0.95 } : {}}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className="text-slate-500 text-4xl">🃏</div>
      </motion.div>
    );
  }
  
  const colorStyle = card.color ? colorClasses[card.color] : null;
  
  return (
    <motion.div
      className={`
        ${sizeClasses} 
        rounded-xl 
        border-4 
        ${isWild ? 'border-slate-700' : colorStyle?.border}
        ${isWild ? 'bg-gradient-to-br from-red-500 via-yellow-500 via-green-500 to-blue-500' : `bg-gradient-to-br ${colorStyle?.gradient}`}
        shadow-lg 
        relative 
        overflow-hidden
        ${disabled ? 'opacity-50 grayscale' : ''}
        ${selected ? 'ring-4 ring-white ring-offset-2 ring-offset-slate-900 -translate-y-4' : ''}
        ${className}
      `}
      whileHover={onClick && !disabled ? { scale: 1.05, y: -8 } : {}}
      whileTap={onClick && !disabled ? { scale: 0.95 } : {}}
      onClick={disabled ? undefined : onClick}
      style={{ cursor: onClick && !disabled ? 'pointer' : 'default' }}
      layout
    >
      {/* Inner white oval */}
      <div className={`
        absolute 
        inset-2 
        ${isWild ? 'bg-slate-900/90' : 'bg-white/90'}
        rounded-full
        transform rotate-12
        flex items-center justify-center
      `}>
        {/* Center content */}
        <div className={`
          ${centerSize}
          font-bold
          ${isWild ? 'text-white' : card.color === 'yellow' ? 'text-yellow-700' : `text-${card.color}-600`}
          drop-shadow-lg
          transform -rotate-12
        `}
        style={{ 
          color: isWild ? 'white' : undefined,
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}
        >
          {content.symbol}
        </div>
      </div>
      
      {/* Top-left corner */}
      <div className={`absolute top-1 left-1 ${cornerSize} font-bold ${isWild ? 'text-white' : 'text-white'} drop-shadow-md`}>
        {content.text}
      </div>
      
      {/* Bottom-right corner (rotated) */}
      <div className={`absolute bottom-1 right-1 ${cornerSize} font-bold ${isWild ? 'text-white' : 'text-white'} drop-shadow-md transform rotate-180`}>
        {content.text}
      </div>
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
    </motion.div>
  );
}

// Card back for deck display
export function CardBack({ small = false, className = '' }: { small?: boolean; className?: string }) {
  const sizeClasses = small 
    ? 'w-12 h-18' 
    : 'w-20 h-28 sm:w-24 sm:h-36';
    
  return (
    <div className={`
      ${sizeClasses} 
      rounded-xl 
      border-4 
      border-slate-600 
      bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 
      shadow-lg 
      flex items-center justify-center
      ${className}
    `}>
      <div className="text-slate-500 text-4xl">🃏</div>
    </div>
  );
}

// Color picker for wild cards
export function ColorPicker({ onPick, disabled = false }: { onPick: (color: CCColor) => void; disabled?: boolean }) {
  const colors: CCColor[] = ['red', 'blue', 'green', 'yellow'];
  
  return (
    <div className="flex gap-4 p-4 bg-slate-800/90 rounded-2xl backdrop-blur-sm">
      {colors.map(color => (
        <motion.button
          key={color}
          onClick={() => !disabled && onPick(color)}
          disabled={disabled}
          className={`
            w-16 h-16 sm:w-20 sm:h-20
            rounded-full
            border-4 border-white/50
            ${colorClasses[color].bg}
            shadow-lg
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          whileHover={!disabled ? { scale: 1.1 } : {}}
          whileTap={!disabled ? { scale: 0.9 } : {}}
        />
      ))}
    </div>
  );
}

// Direction indicator
export function DirectionIndicator({ direction, className = '' }: { direction: 1 | -1; className?: string }) {
  return (
    <motion.div 
      className={`text-4xl ${className}`}
      animate={{ rotate: direction === 1 ? 0 : 180 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      ➡️
    </motion.div>
  );
}

// Active color indicator
export function ActiveColorIndicator({ color, className = '' }: { color: CCColor; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-white/70 text-sm font-bold">ACTIVE:</span>
      <div className={`w-8 h-8 rounded-full ${colorClasses[color].bg} border-2 border-white/50 shadow-lg`} />
    </div>
  );
}
