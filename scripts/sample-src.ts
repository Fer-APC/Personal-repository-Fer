import { parseVoiceInput } from '../src/domain/voice';
const TODAY = '2026-08-27';
const dictations = [
  'on monday i did squats five sets of five at a hundred kilos bench press three sets of eight at sixty kilos my hamstrings are sore more calisthenics',
  'bench press three sets of eight at sixty kilos then lat pulldown four sets of ten at fifty and my chest is sore',
  'pull ups four sets of eight bodyweight dips three sets of twelve bodyweight',
  'i cant train on tuesday and i want to train two days a week',
  'yesterday i did leg press four sets of twelve at one hundred and forty kilos',
];
for (const text of dictations) {
  const r = parseVoiceInput(text, TODAY);
  console.log('\n"' + text.slice(0, 70) + (text.length > 70 ? '…' : '') + '"');
  r.commands.forEach((c) => console.log('   ✓', c.summary));
  r.unrecognised.forEach((u) => console.log('   ✗', JSON.stringify(u)));
}
