import type { FocusItem, Mode, Scenario, Turn } from '../types';

export const START_CUE = '(Start the role-play now. Say your first line only.)';

const SPEECH_NOTE =
  'Learner messages come from speech recognition, so ignore capitalization, punctuation and spelling. Focus on grammar, word choice and natural expressions.';

const CATEGORY_GUIDE =
  'category is one of: missing_verb (missing be-verb or main verb), tense, article (a/an/the), word_choice, word_order, expression (idioms, phrasal verbs, set phrases), adj_adv (adjective vs adverb, -ed vs -ing), culture (nuance, politeness, cultural fit).';

const FEEDBACK_FIELDS = [
  '- original: the learner sentence exactly as given.',
  '- better: the most natural way a native speaker would say it. If it is already natural, copy it unchanged.',
  '- point_ko: one or two short sentences in Korean explaining the key point. Praise what was good. Add a culture or nuance tip only when it really matters.',
  `- ${CATEGORY_GUIDE}`,
  '- ok: true if the meaning was understandable.',
];

export function buildSystemPrompt(scenario: Scenario, mode: Mode, focus: FocusItem[]): string {
  const lines = [
    'You are a friendly English conversation partner for a Korean engineer (CEFR A2 level) preparing for a business trip to the NVIDIA GTC conference in the USA.',
    `Role-play: you are ${scenario.role_en}. Situation: ${scenario.setting_en}`,
    'Stay in character. Speak natural everyday American English, but keep each reply short: 1-2 sentences, simple words, one question at a time.',
    'If the learner seems lost, rephrase more simply. Never use Korean in "reply".',
    `The first user message "${START_CUE}" is only a cue to begin; never correct it.`,
    SPEECH_NOTE,
  ];
  if (mode === 'each') {
    lines.push('For every learner message, fill "feedback" about that message:', ...FEEDBACK_FIELDS);
  } else {
    lines.push('Do not correct the learner during the conversation. Just keep talking naturally.');
  }
  if (focus.length > 0) {
    lines.push('The learner often makes these mistakes. Naturally ask questions that give chances to practice them, without mentioning this list:');
    for (const f of focus) {
      lines.push(`- ${f.category}: ${f.examples.map((e) => `"${e.original}" -> "${e.better}"`).join('; ')}`);
    }
  }
  return lines.join('\n');
}

export function buildReviewPrompt(): string {
  return [
    'You are an English tutor for a Korean engineer (CEFR A2 level). Review the conversation transcript the user sends.',
    'Lines starting with "ME:" are the learner. Lines starting with "PARTNER:" are the conversation partner; never correct those.',
    SPEECH_NOTE,
    'corrections: one item per learner line that has a grammar, word choice or expression problem. Skip lines that are already natural. Fields:',
    ...FEEDBACK_FIELDS,
    'phrases: 3-6 useful English expressions from this conversation worth memorizing, with the Korean meaning in "ko".',
    'summary_ko: 2-3 Korean sentences about what went well and the one thing to focus on next.',
  ].join('\n');
}

export function formatTranscript(turns: Turn[]): string {
  return turns.map((t) => `${t.role === 'user' ? 'ME' : 'PARTNER'}: ${t.text}`).join('\n');
}
