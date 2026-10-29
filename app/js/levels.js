// 80 levels, A-1 to H-10. Each step is a small increase in length, sentence size and vocabulary.
const LETTERS = 'ABCDEFGH';
const LEVEL_COUNT = 80;

// Highest acceptable reading grade (Flesch-Kincaid) per letter. There is headroom because the formula
// over-scores names and topic words; G and H get more since nonfiction at that level scores high.
const BAND_MAX_GRADE = [3, 3.5, 4, 5, 6, 7, 10, 12];

const BANDS = [
  { grade: 'Pre-K / Kindergarten', vocab: 'only short decodable words (cat, sun, big, hop, red) and the easiest sight words (I, a, the, is, see, can, my). No word longer than 5 letters except a name.', skills: 'simple who/what recall' },
  { grade: 'Kindergarten / 1st grade', vocab: 'short-vowel words, blends and digraphs (frog, stop, ship, chick), common sight words, a few easy two-syllable words', skills: 'recall and what happened first/next' },
  { grade: '1st grade', vocab: 'long-vowel and r-controlled words, simple two-syllable words, past tense with -ed, short dialogue', skills: 'sequence, feelings, simple cause and effect' },
  { grade: '2nd grade', vocab: 'compound words, common prefixes and suffixes, a few new words explained by context', skills: 'cause and effect, character reasons, simple facts from nonfiction' },
  { grade: '3rd grade', vocab: 'richer descriptive words, some topic words explained in the text, varied sentence starts', skills: 'main idea, character motives, finding details' },
  { grade: '4th grade', vocab: 'multi-syllable and topic words, simple figurative language (similes), transition words', skills: 'main idea and supporting details, lesson of a story, word meaning from context' },
  { grade: '5th grade', vocab: 'academic words (evidence, migrate, process), idioms, longer complex sentences', skills: 'inference, compare ideas, author purpose, theme' },
  { grade: '6th grade', vocab: 'advanced academic and literary vocabulary, complex sentences with clauses, figurative language', skills: 'inference, theme, point of view, evaluating arguments' },
];

function levelName(i) { return LETTERS[Math.floor(i / 10)] + '-' + (i % 10 + 1); }

function levelSpec(i) {
  const t = i / (LEVEL_COUNT - 1);
  const band = BANDS[Math.floor(i / 10)];
  const words = Math.round(25 + t * 325);
  return {
    index: i, name: levelName(i), letter: LETTERS[Math.floor(i / 10)], step: i % 10 + 1,
    grade: band.grade, vocab: band.vocab, skills: band.skills,
    words, minWords: Math.round(words * 0.8), maxWords: Math.round(words * 1.25),
    sentenceWords: Math.round(4 + t * 11),
    wpmGoal: Math.round(20 + t * 130),
    orderCount: i < 10 ? 3 : i < 40 ? 4 : 5,
  };
}

const TOPICS = ['a pet who gets lost', 'a trip to the market', 'two friends building a fort', 'the moon', 'a rainy day',
  'a garden', 'a helpful robot', 'ocean animals', 'a soccer game', 'baking bread', 'a library visit', 'trains',
  'insects', 'a camping trip', 'volcanoes', 'a new kid at school', 'snow', 'dinosaurs', 'a music lesson',
  'a bike ride', 'how plants grow', 'a lighthouse', 'a lost tooth', 'birds that migrate', 'a science experiment',
  'a family recipe', 'a museum', 'weather', 'a treasure map', 'an inventor', 'a farm in the morning', 'the desert'];
