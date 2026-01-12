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
  
  <!-- Footer -->
  <text x="400" y="570" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#666666">
    Daniel's Dirty Game Pack • Autism Assessment™
  </text>
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
