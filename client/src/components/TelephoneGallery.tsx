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
    <div className="space-y-8">
      {books.map(book => (
        <div key={book.bookId} className="bg-slate-800 rounded-lg p-4">
          <h3 className="text-xl font-bold mb-4 text-center text-yellow-400">
            {getPlayerName(book.ownerId)}'s Book
          </h3>
          <div className="flex flex-col gap-4">
            {book.entries.map((entry, index) => (
              <div key={index} className="bg-slate-700 p-3 rounded-lg text-center">
                <p className="text-sm text-slate-400 mb-2">
                  {entry.type === 'prompt' ? 'Initial Prompt by' : entry.type === 'drawing' ? 'Drawing by' : 'Caption by'} {getPlayerName(entry.authorId)}
                </p>
                {entry.type === 'prompt' && (
                  <p className="text-2xl font-bold text-white">"{entry.content}"</p>
                )}
                {entry.type === 'caption' && (
                  <p className="text-xl italic text-slate-300">"{entry.content}"</p>
                )}
                {entry.type === 'drawing' && entry.content && (
                  <img src={entry.content} alt="A drawing" className="bg-white rounded-md w-full max-w-sm mx-auto" />
                )}
                 {entry.type === 'drawing' && !entry.content && (
                  <div className="w-full max-w-sm mx-auto bg-slate-600 rounded-md aspect-video flex items-center justify-center">
                    <p className="text-slate-400">[Drawing Timed Out]</p>
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
