import React from 'react';

// Define types based on what server sends
interface Entry {
  type: 'prompt' | 'drawing' | 'caption';
  authorId: string;
  content: string;
}

interface Book {
  bookId: string;
  ownerId: string;
  entries: Entry[];
}

interface Player {
    id: string;
    name: string;
    isConnected: boolean;
    isBot?: boolean;
    score: number;
}

interface TelephoneGalleryProps {
  books: Book[];
  players: Player[];
}

const TelephoneGallery: React.FC<TelephoneGalleryProps> = ({ books, players }) => {
  const getPlayerName = (authorId: string) => {
    return players.find(p => p.id === authorId)?.name ?? 'Unknown';
  };

  return (
    <div className="flex space-x-4 p-4 overflow-x-auto bg-slate-900 rounded-lg">
      {books.map(book => (
        <div key={book.bookId} className="bg-slate-800 rounded-lg p-3 w-80 flex-shrink-0">
          <h3 className="text-lg font-bold mb-3 text-center text-yellow-400">
            {getPlayerName(book.ownerId)}'s Book
          </h3>
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            {book.entries.map((entry, index) => (
              <div key={index} className="bg-slate-700 p-2 rounded-md text-center">
                <p className="text-xs text-slate-400 mb-1">
                  {entry.type === 'prompt' ? 'Initial Prompt by' : entry.type === 'drawing' ? 'Drawing by' : 'Caption by'} {getPlayerName(entry.authorId)}
                </p>
                {entry.type === 'prompt' && (
                  <p className="text-lg font-semibold text-white">"{entry.content}"</p>
                )}
                {entry.type === 'caption' && (
                  <p className="text-base italic text-slate-300">"{entry.content}"</p>
                )}
                {entry.type === 'drawing' && entry.content && (
                  <img src={entry.content} alt="A drawing" className="bg-white rounded-sm w-full max-w-full mx-auto" />
                )}
                 {entry.type === 'drawing' && !entry.content && (
                  <div className="w-full max-w-full mx-auto bg-slate-600 rounded-md aspect-video flex items-center justify-center">
                    <p className="text-slate-400 text-sm">[Drawing Timed Out]</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TelephoneGallery;
