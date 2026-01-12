#!/usr/bin/env python3

with open('/home/daniel/DanielDirtyGamePack/server/src/game.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = '''  private async generateBotPrompt(kind: 'nasty_prompt' | 'nasty_answer' | 'dp_problem' | 'dp_answer', context?: string) {
    const fromApi = await this.tryBotApi(kind, context);
    if (fromApi) return fromApi;

    if (kind === 'nasty_prompt') {
      // Use the imported nasty prompts list
      return this.pick(nastyPrompts);
    }

    if (kind === 'dp_problem') {
      const templates = [
        "I can't stop losing my keys.",
        'My group chats never stop buzzing.',
        'My socks keep disappearing in the laundry.',
        'I always spill drinks at the worst time.',
        "I can't remember why I walked into a room.",
        'My neighbor plays loud music at 3am.',
        "I always forget people's names immediately.",
        'My phone battery dies at the worst moments.',
        'I can never find matching Tupperware lids.',
        'I keep getting spam calls during meetings.'
      ];
      return this.pick(templates);
    }

    if (kind === 'nasty_answer') {
      // Use the imported nasty answers list
      return this.pick(nastyAnswers);
    }

    // DP invention titles - make them creative and relevant
    const prefix = this.pick(['The', 'My', 'Introducing:', 'Behold!', 'Patent Pending:', '']);
    const adj = this.pick(['Turbo', 'Mega', 'Ultra', 'Quantum', 'Pocket', 'Self-Aware', 'Artisanal', 'Blockchain', 'AI-Powered', 'Organic', 'Military-Grade', 'Sentient', 'Tactical', 'Moisturized', 'Forbidden']);
    const noun = this.pick(['Buddy', 'Gizmo', '3000', 'Pro Max', 'Deluxe', 'Helper', 'Solution', '-Matic', 'Blaster', 'Eliminator', 'Wizard', 'Master', 'Destroyer']);
    const core = this.pick([
      `${adj} Problem ${noun}`,
      `${adj} ${noun}`,
      `${adj} Life ${noun}`,
      `${this.pick(['Auto', 'Robo', 'Smart', 'E-'])}${this.pick(['Fix', 'Solve', 'Helper', 'Buddy'])} ${noun}`,
      `The "${context?.slice(0, 20) ?? 'Problem'}" ${noun}`
    ]);
    const suffix = this.pick([
      ' - It just works!',
      ' (patent pending)',
      ' - Problem solved!',
      ' - Trust me bro.',
      ' - What could go wrong?',
      '',
      ' - As seen on TV!',
      ' - Now with extra features!'
    ]);
    return `${prefix} ${core}${suffix}`.replace(/\\s+/g, ' ').trim();
  }'''

lines = content.split('\\n')
start_line = None
end_line = None
brace_count = 0
in_function = False

for i, line in enumerate(lines):
    if 'private async generateBotPrompt' in line:
        start_line = i
        in_function = True
        brace_count = line.count('{') - line.count('}')
        continue
    if in_function:
        brace_count += line.count('{') - line.count('}')
        if brace_count == 0:
            end_line = i
            break

if start_line is not None and end_line is not None:
    new_lines = lines[:start_line] + new_func.split('\\n') + lines[end_line+1:]
    with open('/home/daniel/DanielDirtyGamePack/server/src/game.ts', 'w', encoding='utf-8') as f:
        f.write('\\n'.join(new_lines))
    print(f"Replaced function from line {start_line+1} to {end_line+1}")
else:
    print("Function not found")
