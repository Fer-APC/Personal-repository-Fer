import { normalise, parseVoiceInput } from '../src/domain/voice';
const TODAY = '2026-08-27';
for (const phrase of ['Give me the 2 day routine for this week', 'show me next week', 'what was my plan last week']) {
  console.log(JSON.stringify(phrase));
  console.log('  normalised:', JSON.stringify(normalise(phrase)));
  console.log('  parsed:', JSON.stringify(parseVoiceInput(phrase, TODAY)));
}
