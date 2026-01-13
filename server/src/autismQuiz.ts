// Autism Quotient (AQ) inspired questions for the party game
// Based on common autism screening questions, adapted for humor
// Higher agreement = higher autism score

export interface QuizQuestion {
  id: number;
  text: string;
  // true = "Agree" increases score, false = "Disagree" increases score
  agreeIsAutistic: boolean;
}

export const autismQuizQuestions: QuizQuestion[] = [
  // Original 20 questions
  { id: 1, text: "I prefer to do things the same way over and over again.", agreeIsAutistic: true },
  { id: 2, text: "I find it easy to read between the lines when someone is talking to me.", agreeIsAutistic: false },
  { id: 3, text: "I find it hard to make new friends.", agreeIsAutistic: true },
  { id: 4, text: "I frequently get so absorbed in one thing that I lose sight of other things.", agreeIsAutistic: true },
  { id: 5, text: "I find social situations easy.", agreeIsAutistic: false },
  { id: 6, text: "I tend to notice details that others do not.", agreeIsAutistic: true },
  { id: 7, text: "I find it easy to do more than one thing at once.", agreeIsAutistic: false },
  { id: 8, text: "I would rather go to a library than a party.", agreeIsAutistic: true },
  { id: 9, text: "I find it easy to work out what someone is thinking or feeling just by looking at their face.", agreeIsAutistic: false },
  { id: 10, text: "I am fascinated by dates.", agreeIsAutistic: true },
  { id: 11, text: "I find it easy to play games with children that involve pretending.", agreeIsAutistic: false },
  { id: 12, text: "I like to collect information about categories of things.", agreeIsAutistic: true },
  { id: 13, text: "I find it difficult to imagine what it would be like to be someone else.", agreeIsAutistic: true },
  { id: 14, text: "I would rather go to the theatre than a museum.", agreeIsAutistic: false },
  { id: 15, text: "I find making up stories easy.", agreeIsAutistic: false },
  { id: 16, text: "I am drawn more strongly to people than to things.", agreeIsAutistic: false },
  { id: 17, text: "I tend to have very strong interests which I get upset about if I can't pursue.", agreeIsAutistic: true },
  { id: 18, text: "I enjoy social chit-chat.", agreeIsAutistic: false },
  { id: 19, text: "I am good at remembering phone numbers.", agreeIsAutistic: true },
  { id: 20, text: "New situations make me anxious.", agreeIsAutistic: true },
  // Additional questions (21-100)
  { id: 21, text: "I often notice small sounds when others do not.", agreeIsAutistic: true },
  { id: 22, text: "I usually notice car number plates or similar strings of information.", agreeIsAutistic: true },
  { id: 23, text: "Other people frequently tell me that what I've said is impolite.", agreeIsAutistic: true },
  { id: 24, text: "I can easily tell if someone else wants to enter a conversation.", agreeIsAutistic: false },
  { id: 25, text: "I am often the last to understand the point of a joke.", agreeIsAutistic: true },
  { id: 26, text: "I find it easy to figure out what someone is feeling by looking at their face.", agreeIsAutistic: false },
  { id: 27, text: "If there is an interruption, I can switch back to what I was doing very quickly.", agreeIsAutistic: false },
  { id: 28, text: "I enjoy doing things spontaneously.", agreeIsAutistic: false },
  { id: 29, text: "I am often so focused on one thing that I become oblivious to everything around me.", agreeIsAutistic: true },
  { id: 30, text: "I find it hard to know when it's my turn to speak in a conversation.", agreeIsAutistic: true },
  { id: 31, text: "I prefer to meet my friends one-on-one rather than in a group.", agreeIsAutistic: true },
  { id: 32, text: "I can tell when someone is hiding their true feelings.", agreeIsAutistic: false },
  { id: 33, text: "I prefer to do things with others rather than on my own.", agreeIsAutistic: false },
  { id: 34, text: "I can easily tell when someone is being sarcastic.", agreeIsAutistic: false },
  { id: 35, text: "I find it difficult to work out people's intentions.", agreeIsAutistic: true },
  { id: 36, text: "I am good at predicting how someone will feel.", agreeIsAutistic: false },
  { id: 37, text: "When I'm reading a story, I find it difficult to work out the characters' intentions.", agreeIsAutistic: true },
  { id: 38, text: "I notice patterns in things all the time.", agreeIsAutistic: true },
  { id: 39, text: "I would rather go to a museum than a rock concert.", agreeIsAutistic: true },
  { id: 40, text: "I find it easy to make small talk.", agreeIsAutistic: false },
  { id: 41, text: "When I talk, it isn't always easy for others to get a word in.", agreeIsAutistic: true },
  { id: 42, text: "I am fascinated by numbers.", agreeIsAutistic: true },
  { id: 43, text: "When I'm reading a story, I can easily imagine what the characters might look like.", agreeIsAutistic: false },
  { id: 44, text: "People often tell me that I keep going on and on about the same thing.", agreeIsAutistic: true },
  { id: 45, text: "I find myself drawn more strongly to things than to people.", agreeIsAutistic: true },
  { id: 46, text: "I tend to have very strong interests that I get upset about if I can't pursue them.", agreeIsAutistic: true },
  { id: 47, text: "I enjoy meeting new people.", agreeIsAutistic: false },
  { id: 48, text: "I am a good diplomat.", agreeIsAutistic: false },
  { id: 49, text: "I am not very good at remembering people's date of birth.", agreeIsAutistic: false },
  { id: 50, text: "I find it very easy to play games with children that involve pretending.", agreeIsAutistic: false },
  { id: 51, text: "I like to plan any activities I participate in carefully.", agreeIsAutistic: true },
  { id: 52, text: "I enjoy social occasions.", agreeIsAutistic: false },
  { id: 53, text: "I find it difficult to work out what someone is thinking or feeling by looking at their face.", agreeIsAutistic: true },
  { id: 54, text: "I would rather go alone than with someone else when I go somewhere.", agreeIsAutistic: true },
  { id: 55, text: "I often have trouble expressing my feelings in words.", agreeIsAutistic: true },
  { id: 56, text: "I can easily tell when someone is bored with what I'm saying.", agreeIsAutistic: false },
  { id: 57, text: "I prefer practical jokes to verbal humor.", agreeIsAutistic: true },
  { id: 58, text: "I feel overwhelmed in loud, busy environments.", agreeIsAutistic: true },
  { id: 59, text: "I enjoy being the center of attention.", agreeIsAutistic: false },
  { id: 60, text: "I memorize facts about my special interests easily.", agreeIsAutistic: true },
  { id: 61, text: "People say I have unusual ways of expressing myself.", agreeIsAutistic: true },
  { id: 62, text: "I find it easy to adapt when plans change unexpectedly.", agreeIsAutistic: false },
  { id: 63, text: "I often rehearse conversations before having them.", agreeIsAutistic: true },
  { id: 64, text: "I can easily read body language.", agreeIsAutistic: false },
  { id: 65, text: "I prefer written communication over phone calls.", agreeIsAutistic: true },
  { id: 66, text: "I often miss social cues in conversations.", agreeIsAutistic: true },
  { id: 67, text: "I find it easy to make eye contact during conversations.", agreeIsAutistic: false },
  { id: 68, text: "I get very upset if my daily routine is disrupted.", agreeIsAutistic: true },
  { id: 69, text: "I enjoy trying new foods.", agreeIsAutistic: false },
  { id: 70, text: "I have a hard time understanding why people get emotional about things.", agreeIsAutistic: true },
  { id: 71, text: "I can easily tell when someone is being polite but doesn't mean it.", agreeIsAutistic: false },
  { id: 72, text: "I notice when small things in my environment have been moved or changed.", agreeIsAutistic: true },
  { id: 73, text: "I find group projects easier than working alone.", agreeIsAutistic: false },
  { id: 74, text: "I sometimes say things that others think are blunt or rude.", agreeIsAutistic: true },
  { id: 75, text: "I am good at sensing the mood of a room when I enter it.", agreeIsAutistic: false },
  { id: 76, text: "I prefer to eat the same foods regularly rather than try new dishes.", agreeIsAutistic: true },
  { id: 77, text: "I can easily tell the difference between similar shades of color.", agreeIsAutistic: true },
  { id: 78, text: "I find networking events enjoyable.", agreeIsAutistic: false },
  { id: 79, text: "I often forget to respond to text messages or emails.", agreeIsAutistic: true },
  { id: 80, text: "I am good at guessing what gift someone would like.", agreeIsAutistic: false },
  { id: 81, text: "I feel uncomfortable when people stand too close to me.", agreeIsAutistic: true },
  { id: 82, text: "I can easily follow conversations with multiple people talking.", agreeIsAutistic: false },
  { id: 83, text: "I have trouble understanding idioms and figures of speech.", agreeIsAutistic: true },
  { id: 84, text: "I get anxious when I have to deviate from my planned route.", agreeIsAutistic: true },
  { id: 85, text: "I enjoy parties and social gatherings.", agreeIsAutistic: false },
  { id: 86, text: "I can spend hours researching topics that interest me.", agreeIsAutistic: true },
  { id: 87, text: "I find it easy to comfort someone who is upset.", agreeIsAutistic: false },
  { id: 88, text: "I prefer to have a detailed schedule for my day.", agreeIsAutistic: true },
  { id: 89, text: "I am good at improvising in conversations.", agreeIsAutistic: false },
  { id: 90, text: "I notice grammatical errors that others miss.", agreeIsAutistic: true },
  { id: 91, text: "I find it difficult to lie convincingly.", agreeIsAutistic: true },
  { id: 92, text: "I enjoy team sports.", agreeIsAutistic: false },
  { id: 93, text: "I often take things literally when people don't mean them that way.", agreeIsAutistic: true },
  { id: 94, text: "I can easily pick up on subtle hints in conversation.", agreeIsAutistic: false },
  { id: 95, text: "I get overwhelmed when there are too many choices.", agreeIsAutistic: true },
  { id: 96, text: "I find it easy to strike up conversations with strangers.", agreeIsAutistic: false },
  { id: 97, text: "I prefer factual books or documentaries over fiction.", agreeIsAutistic: true },
  { id: 98, text: "I am good at reading between the lines in emails.", agreeIsAutistic: false },
  { id: 99, text: "I have specific ways of doing things that I don't like to change.", agreeIsAutistic: true },
  { id: 100, text: "I find it easy to know when someone wants to end a conversation.", agreeIsAutistic: false },
];

// Generate a certificate SVG
export function generateCertificateSVG(
  winnerName: string,
  rankings: { name: string; score: number }[]
): string {
  const rankingsText = rankings
    .map((r, i) => `${i + 1}. ${r.name} - Score: ${r.score}/20`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f4d03f;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#f1c40f;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#d4ac0d;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="800" height="600" fill="#1a1a2e"/>
  
  <!-- Border -->
  <rect x="20" y="20" width="760" height="560" fill="none" stroke="url(#goldGrad)" stroke-width="8" rx="10"/>
  <rect x="35" y="35" width="730" height="530" fill="none" stroke="url(#goldGrad)" stroke-width="2" rx="8"/>
  
  <!-- Header decoration -->
  <circle cx="400" cy="80" r="40" fill="url(#goldGrad)" filter="url(#shadow)"/>
  <text x="400" y="90" text-anchor="middle" font-size="36" fill="#1a1a2e">🏆</text>
  
  <!-- Title -->
  <text x="400" y="160" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="url(#goldGrad)" font-weight="bold" filter="url(#shadow)">
    CERTIFICATE OF ACHIEVEMENT
  </text>
  
  <!-- Subtitle -->
  <text x="400" y="200" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#b8b8b8">
    This certifies that
  </text>
  
  <!-- Winner Name -->
  <text x="400" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="48" fill="#ffffff" font-weight="bold" filter="url(#shadow)">
    ${escapeXmlForCert(winnerName)}
  </text>
  
  <!-- Award Title -->
  <text x="400" y="310" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#b8b8b8">
    has been officially recognized as
  </text>
  
  <text x="400" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#4ade80" font-weight="bold" filter="url(#shadow)">
    CERTIFIED LEAST AUTISTIC
  </text>
  
  <!-- Rankings section -->
  <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#888888">
    GROUP RANKINGS
  </text>
  
  ${rankings.slice(0, 6).map((r, i) => `
  <text x="400" y="${450 + i * 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${i === 0 ? '#4ade80' : '#cccccc'}">
    ${i + 1}. ${escapeXmlForCert(r.name)} — Score: ${r.score}/20
  </text>`).join('')}
</svg>`;
}

function escapeXmlForCert(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate a certificate for the MOST autistic player
export function generateMostAutisticCertificateSVG(
  loserName: string,
  rankings: { name: string; score: number }[]
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#9b59b6;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#8e44ad;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6c3483;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="800" height="600" fill="#1a1a2e"/>
  
  <!-- Border -->
  <rect x="20" y="20" width="760" height="560" fill="none" stroke="url(#purpleGrad)" stroke-width="8" rx="10"/>
  <rect x="35" y="35" width="730" height="530" fill="none" stroke="url(#purpleGrad)" stroke-width="2" rx="8"/>
  
  <!-- Header decoration -->
  <circle cx="400" cy="80" r="40" fill="url(#purpleGrad)" filter="url(#shadow)"/>
  <text x="400" y="90" text-anchor="middle" font-size="36" fill="#1a1a2e">🧩</text>
  
  <!-- Title -->
  <text x="400" y="160" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="url(#purpleGrad)" font-weight="bold" filter="url(#shadow)">
    CERTIFICATE OF DISTINCTION
  </text>
  
  <!-- Subtitle -->
  <text x="400" y="200" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#b8b8b8">
    This certifies that
  </text>
  
  <!-- Loser Name -->
  <text x="400" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="48" fill="#ffffff" font-weight="bold" filter="url(#shadow)">
    ${escapeXmlForCert(loserName)}
  </text>
  
  <!-- Award Title -->
  <text x="400" y="310" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="#b8b8b8">
    has been officially recognized as
  </text>
  
  <text x="400" y="360" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#a855f7" font-weight="bold" filter="url(#shadow)">
    CERTIFIED MOST AUTISTIC
  </text>
  
  <!-- Rankings section -->
  <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#888888">
    GROUP RANKINGS
  </text>
  
  ${rankings.slice(0, 6).map((r, i) => `
  <text x="400" y="${450 + i * 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${i === rankings.length - 1 ? '#a855f7' : '#cccccc'}">
    ${i + 1}. ${escapeXmlForCert(r.name)} — Score: ${r.score}/20
  </text>`).join('')}
</svg>`;
}
