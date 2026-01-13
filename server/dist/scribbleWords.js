"use strict";
// Scribble Scrabble word list and utilities
Object.defineProperty(exports, "__esModule", { value: true });
exports.scribbleWords = void 0;
exports.generateWordOptions = generateWordOptions;
exports.isCloseGuess = isCloseGuess;
exports.isCorrectGuess = isCorrectGuess;
exports.generateWordHint = generateWordHint;
exports.scribbleWords = [
    // Animals
    'dog', 'cat', 'elephant', 'giraffe', 'lion', 'tiger', 'bear', 'monkey', 'penguin', 'dolphin',
    'whale', 'shark', 'octopus', 'butterfly', 'spider', 'snake', 'frog', 'turtle', 'rabbit', 'horse',
    'cow', 'pig', 'chicken', 'duck', 'owl', 'eagle', 'parrot', 'flamingo', 'kangaroo', 'koala',
    'zebra', 'hippo', 'rhino', 'crocodile', 'lobster', 'crab', 'jellyfish', 'starfish', 'bee', 'ant',
    // Food
    'pizza', 'hamburger', 'hotdog', 'taco', 'sushi', 'sandwich', 'cake', 'cookie', 'donut', 'icecream',
    'apple', 'banana', 'orange', 'watermelon', 'strawberry', 'grapes', 'pineapple', 'cherry', 'lemon', 'avocado',
    'carrot', 'broccoli', 'corn', 'potato', 'tomato', 'onion', 'mushroom', 'cheese', 'egg', 'bacon',
    'popcorn', 'pretzel', 'pancake', 'waffle', 'burrito', 'noodles', 'bread', 'butter', 'chocolate', 'candy',
    // Objects
    'phone', 'computer', 'television', 'camera', 'clock', 'lamp', 'chair', 'table', 'bed', 'couch',
    'book', 'pencil', 'scissors', 'umbrella', 'glasses', 'hat', 'shoe', 'sock', 'shirt', 'pants',
    'key', 'door', 'window', 'mirror', 'brush', 'toothbrush', 'soap', 'towel', 'pillow', 'blanket',
    'guitar', 'piano', 'drum', 'microphone', 'headphones', 'balloon', 'candle', 'gift', 'trophy', 'medal',
    // Places & Buildings
    'house', 'castle', 'hospital', 'school', 'church', 'prison', 'lighthouse', 'pyramid', 'igloo', 'tent',
    'bridge', 'tower', 'windmill', 'barn', 'garage', 'airport', 'beach', 'mountain', 'volcano', 'island',
    'forest', 'desert', 'jungle', 'cave', 'waterfall', 'lake', 'river', 'ocean', 'moon', 'sun',
    // Transportation
    'car', 'bus', 'train', 'airplane', 'helicopter', 'boat', 'ship', 'submarine', 'rocket', 'bicycle',
    'motorcycle', 'skateboard', 'scooter', 'tractor', 'firetruck', 'ambulance', 'taxi', 'spaceship', 'hotairballoon', 'rollercoaster',
    // People & Body Parts
    'baby', 'wizard', 'pirate', 'ninja', 'robot', 'alien', 'zombie', 'vampire', 'mermaid', 'angel',
    'eye', 'nose', 'mouth', 'ear', 'hand', 'foot', 'brain', 'heart', 'skeleton', 'muscle',
    // Nature
    'tree', 'flower', 'grass', 'leaf', 'rainbow', 'cloud', 'rain', 'snow', 'lightning', 'tornado',
    'fire', 'water', 'earth', 'star', 'comet', 'mushroom', 'cactus', 'palm', 'rose', 'sunflower',
    // Activities & Sports
    'football', 'basketball', 'baseball', 'tennis', 'golf', 'bowling', 'swimming', 'skiing', 'surfing', 'fishing',
    'dancing', 'singing', 'painting', 'cooking', 'sleeping', 'running', 'jumping', 'climbing', 'boxing', 'yoga',
    // Fantasy & Misc
    'dragon', 'unicorn', 'ghost', 'monster', 'dinosaur', 'crown', 'sword', 'shield', 'wand', 'treasure',
    'skull', 'bomb', 'anchor', 'compass', 'map', 'flag', 'dice', 'puzzle', 'magnet', 'battery',
    // More objects
    'hammer', 'screwdriver', 'wrench', 'saw', 'ladder', 'rope', 'chain', 'wheel', 'gear', 'spring',
    'envelope', 'stamp', 'newspaper', 'magazine', 'calendar', 'calculator', 'keyboard', 'mouse', 'printer', 'speaker',
];
/**
 * Generate 3 random word options for the drawer to choose from
 */
function generateWordOptions() {
    const shuffled = [...exports.scribbleWords].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
}
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}
/**
 * Check if a guess is "close" to the word
 * Returns true if within threshold (≤1 for short words ≤5 chars, ≤2 for longer)
 */
function isCloseGuess(guess, word) {
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedWord = word.toLowerCase().trim();
    // Exact match is not "close", it's correct
    if (normalizedGuess === normalizedWord)
        return false;
    const distance = levenshteinDistance(normalizedGuess, normalizedWord);
    const threshold = normalizedWord.length <= 5 ? 1 : 2;
    return distance <= threshold;
}
/**
 * Check if guess is correct (case-insensitive, trimmed)
 */
function isCorrectGuess(guess, word) {
    return guess.toLowerCase().trim() === word.toLowerCase().trim();
}
/**
 * Generate word hint with revealed letters
 * @param word The full word
 * @param revealedIndices Array of indices that should be revealed
 * @returns Hint string like "_ a _ _ y"
 */
function generateWordHint(word, revealedIndices) {
    return word
        .split('')
        .map((char, i) => {
        if (char === ' ')
            return '  ';
        if (revealedIndices.includes(i))
            return char.toUpperCase();
        return '_';
    })
        .join(' ');
}
