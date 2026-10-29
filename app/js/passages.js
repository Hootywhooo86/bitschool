// Built-in passages: two per letter (steps 1 and 6). They drive the placement test and are the
// offline fallback when the local model is not running. Model stories use the same shape.
const BUILTIN = [
  { id: 'b-a1', level: 0, title: 'The Cat',
    text: 'I see a cat. The cat is big. The cat is red. The cat can sit. I pet the cat.',
    questions: [
      { type: 'mc', q: 'What color is the cat?', choices: ['red', 'blue', 'green'], answer: 0 },
      { type: 'mc', q: 'What can the cat do?', choices: ['sit', 'fly', 'swim'], answer: 0 },
      { type: 'open', q: 'What is this story about?', idea: 'a big red cat' },
    ],
    vocab: { pet: 'to touch an animal in a gentle, kind way' },
    circle: { kind: 'word', prompt: 'Circle the word "cat".', sentence: 'I see a cat.', targets: ['cat'] } },

  { id: 'b-a6', level: 5, title: 'Sam and the Sun',
    text: 'Sam ran up the hill. The sun was hot. Sam sat on a rock. He had a cup. The cup had ice in it. Sam got a sip. Now Sam is not hot. Sam is glad.',
    questions: [
      { type: 'mc', q: 'Where did Sam sit?', choices: ['on a rock', 'in a bed', 'on a bus'], answer: 0 },
      { type: 'mc', q: 'What was in the cup?', choices: ['ice', 'mud', 'a bug'], answer: 0 },
      { type: 'open', q: 'How did Sam feel at the end? Why?', idea: 'glad or happy because he was not hot anymore after a cold sip' },
    ],
    vocab: { glad: 'happy', sip: 'a very small drink' },
    circle: { kind: 'word', prompt: 'Circle the word that tells what Sam did.', sentence: 'Sam ran up the hill.', targets: ['ran'] } },

  { id: 'b-b1', level: 10, title: 'The Frog Pond',
    text: 'A green frog sat on a log in the pond. Plop! The frog hopped in the water. It swam fast. A fish swam past it. The frog did not stop. It went to a big lily pad. The frog sat in the sun. It was a good spot to rest.',
    questions: [
      { type: 'mc', q: 'Where did the frog sit first?', choices: ['on a log', 'on a rock', 'in a tree'], answer: 0 },
      { type: 'mc', q: 'Where did the frog go at the end?', choices: ['a big lily pad', 'a nest', 'the sand'], answer: 0 },
      { type: 'open', q: 'What did the frog do in the story?', idea: 'sat on a log, hopped in and swam, then rested in the sun on a lily pad' },
    ],
    vocab: { pond: 'a small lake', rest: 'to stop and relax', spot: 'a place' },
    circle: { kind: 'word', prompt: 'Circle the animal.', sentence: 'A fish swam past it.', targets: ['fish'] } },

  { id: 'b-b6', level: 15, title: "Jen's Best Kite",
    text: 'Jen had a kite with a long tail. It was pink and black. On a windy day, Jen ran to the park with her dad. She let the string go up, up, up. The kite went higher than the trees! Then the wind stopped, and the kite fell down. Jen did not quit. She ran again, and the kite went back up in the sky.',
    questions: [
      { type: 'mc', q: 'Who went to the park with Jen?', choices: ['her dad', 'her cat', 'her teacher'], answer: 0 },
      { type: 'mc', q: 'Why did the kite fall?', choices: ['the wind stopped', 'the string broke', 'it rained'], answer: 0 },
      { type: 'open', q: 'What did Jen do when the kite fell?', idea: 'she did not quit, she ran again and the kite went back up' },
    ],
    vocab: { windy: 'when a lot of wind is blowing', quit: 'to stop trying', string: 'a thin rope' },
    circle: { kind: 'word', prompt: 'Circle the word that tells how Jen moved.', sentence: 'She ran again.', targets: ['ran'] } },

  { id: 'b-c1', level: 20, title: 'Rain Day',
    text: 'It was raining hard, so Mike could not play outside. He looked out the window and felt sad. Then his grandma came in with a big box. Inside were paper, glue, and paint. "Let\'s make a boat," she said. They folded the paper and painted it blue. When the rain stopped, Mike put his boat in a puddle. It floated! Mike smiled. A rainy day was fun after all.',
    questions: [
      { type: 'mc', q: "Why couldn't Mike play outside?", choices: ['It was raining hard.', 'He was sick.', 'It was night.'], answer: 0 },
      { type: 'mc', q: 'What did Mike and Grandma make?', choices: ['a paper boat', 'a cake', 'a kite'], answer: 0 },
      { type: 'open', q: "How did Mike's feelings change from the start to the end?", idea: 'he was sad at first and happy at the end because the boat floated' },
    ],
    vocab: { puddle: 'a small pool of water on the ground', floated: 'stayed on top of the water', folded: 'bent paper over itself' },
    circle: { kind: 'word', prompt: 'Circle the word that tells how Mike felt.', sentence: 'He looked out the window and felt sad.', targets: ['sad'] } },

  { id: 'b-c6', level: 25, title: 'The Lost Mitten',
    text: 'On the first snowy morning of winter, Lily wore her new purple mittens to school. At recess, she built a snowman with her friend Omar. When the bell rang, Lily reached into her pocket. Only one mitten was there! She searched near the slide and behind the swings. Finally, Omar pointed at the snowman. Its nose was not a carrot. It was Lily\'s purple mitten, rolled up tight. Both friends laughed so hard they almost fell into the snow.',
    questions: [
      { type: 'mc', q: 'What did Lily and Omar build?', choices: ['a snowman', 'a fort', 'a sled'], answer: 0 },
      { type: 'mc', q: 'Where was the lost mitten?', choices: ["on the snowman's nose", 'under the slide', 'in the classroom'], answer: 0 },
      { type: 'open', q: 'Why did the friends laugh?', idea: "the lost mitten was the snowman's nose, which was funny" },
    ],
    vocab: { recess: 'a break time to play at school', searched: 'looked carefully for something', mittens: 'warm gloves without separate fingers' },
    circle: { kind: 'word', prompt: 'Circle the two describing words.', sentence: 'Lily wore her new purple mittens.', targets: ['new', 'purple'] } },

  { id: 'b-d1', level: 30, title: 'How Bees Make Honey',
    text: 'Honeybees are busy insects. All summer long, worker bees fly from flower to flower. They drink a sweet juice called nectar and carry it back to their hive. Inside the hive, the bees pass the nectar to one another. Then they store it in tiny wax rooms called cells. The bees fan their wings to dry the nectar. Slowly, it turns thick and sticky. That is honey! The bees eat the honey in winter, when there are no flowers to visit.',
    questions: [
      { type: 'mc', q: 'What is nectar?', choices: ['a sweet juice in flowers', 'a kind of wax', "a bee's wing"], answer: 0 },
      { type: 'mc', q: 'Why do bees fan their wings?', choices: ['to dry the nectar', 'to stay warm', 'to scare birds'], answer: 0 },
      { type: 'open', q: 'Why do bees need honey in winter?', idea: 'there are no flowers in winter, so they eat the stored honey as food' },
    ],
    vocab: { nectar: 'a sweet juice made by flowers', hive: 'the home where bees live', insects: 'small animals with six legs' },
    circle: { kind: 'word', prompt: 'Circle the verb (the action word).', sentence: 'Worker bees fly from flower to flower.', targets: ['fly'] } },

  { id: 'b-d6', level: 35, title: 'The Science Fair',
    text: 'Priya wanted to win a ribbon at the science fair. Her idea was simple: which melts faster, ice in the sun or ice in the shade? She placed two ice cubes on matching plates and checked them every five minutes. She wrote the times in a notebook. The cube in the sun melted in twenty minutes. The cube in the shade lasted almost an hour. At the fair, Priya explained her results with a bright poster. She did not win first place, but the judges gave her a ribbon for the clearest experiment.',
    questions: [
      { type: 'mc', q: "What was Priya's question?", choices: ['Which ice melts faster, in the sun or the shade?', 'Which plant grows tallest?', 'How far can a ball roll?'], answer: 0 },
      { type: 'mc', q: 'How long did the cube in the sun take to melt?', choices: ['twenty minutes', 'five minutes', 'one hour'], answer: 0 },
      { type: 'open', q: 'Why do you think the judges liked her experiment?', idea: 'it was clear and careful: she checked every five minutes, wrote down the times, and explained results on a poster' },
    ],
    vocab: { experiment: 'a test to find something out', results: 'what you find out at the end', judges: 'people who decide who wins' },
    circle: { kind: 'word', prompt: 'Circle the nouns that name people.', sentence: 'The judges gave Priya a ribbon.', targets: ['judges', 'priya'] } },

  { id: 'b-e1', level: 40, title: "Grandpa's Garden",
    text: 'Every spring, Grandpa Luis turns the empty corner of his yard into a garden. First, he loosens the hard soil with a shovel so the roots can spread. Next, his grandson Marco helps him plant seeds in straight rows: beans, squash, and corn. Grandpa explains that these three plants are called "the three sisters" because they help each other grow. The tall corn gives the beans something to climb. The beans add good things to the soil. The squash leaves spread out like umbrellas, shading the ground so weeds cannot grow. By August, the corner is crowded with food.',
    questions: [
      { type: 'mc', q: 'Why does Grandpa loosen the soil?', choices: ['so the roots can spread', 'to find worms', 'to make it flat'], answer: 0 },
      { type: 'mc', q: 'How do the squash leaves help?', choices: ["They shade the ground so weeds can't grow.", 'They hold up the beans.', 'They make the corn taller.'], answer: 0 },
      { type: 'open', q: 'Why are the plants called "the three sisters"?', idea: 'they help each other grow, like sisters helping each other' },
    ],
    vocab: { loosens: 'makes less tight or hard', soil: 'dirt where plants grow', crowded: 'very full' },
    circle: { kind: 'word', prompt: 'Circle the two verbs.', sentence: 'The tall corn gives the beans something to climb.', targets: ['gives', 'climb'] } },

  { id: 'b-e6', level: 45, title: "The Lighthouse Keeper's Cat",
    text: 'Long ago, a lighthouse stood on a rocky island far from shore. The keeper, Mrs. Hale, lived there with a gray cat named Pepper. Each night, Mrs. Hale climbed the winding stairs to light the great lamp so ships would not crash into the rocks. One stormy evening, the wind roared so loudly that she did not hear a boat\'s horn. But Pepper did. The cat yowled and scratched at the door until Mrs. Hale looked out. She saw a small fishing boat drifting toward danger. She quickly turned the beam toward it, and the fishermen steered safely away. From then on, the sailors called Pepper "the island\'s second keeper."',
    questions: [
      { type: 'mc', q: 'Why did Mrs. Hale light the lamp each night?', choices: ['so ships would not crash into the rocks', 'to read books', 'to keep Pepper warm'], answer: 0 },
      { type: 'mc', q: 'How did Pepper help?', choices: ['Pepper yowled and scratched at the door.', 'Pepper rang a bell.', 'Pepper swam to the boat.'], answer: 0 },
      { type: 'open', q: 'Why did the sailors call Pepper "the island\'s second keeper"?', idea: 'Pepper warned Mrs. Hale and helped save the boat, doing a keeper\'s job' },
    ],
    vocab: { keeper: 'a person who takes care of a place', drifting: 'moving slowly with the water or wind', steered: 'turned a boat to go a certain way' },
    circle: { kind: 'word', prompt: 'Circle the word that tells HOW she turned the beam.', sentence: 'She quickly turned the beam toward the boat.', targets: ['quickly'] } },

  { id: 'b-f1', level: 50, title: 'Why Leaves Change Color',
    text: 'In the fall, many trees put on a show of red, orange, and gold. But where do those colors come from? During spring and summer, leaves are filled with a green chemical called chlorophyll. Chlorophyll helps leaves use sunlight to make food for the tree, and its green color hides the other colors in the leaf. When days grow shorter and cooler, the tree stops making chlorophyll. As the green fades, the yellow and orange that were there all along finally appear. Some trees, like maples, also make new red colors in the fall. Eventually, the leaves dry up and drop, and the tree rests until spring.',
    questions: [
      { type: 'mc', q: 'What does chlorophyll do?', choices: ['helps leaves use sunlight to make food', 'makes leaves fall', 'turns leaves red'], answer: 0 },
      { type: 'mc', q: 'Why do yellow and orange appear in fall?', choices: ['The green fades and stops hiding them.', 'The rain paints them.', 'Birds bring them.'], answer: 0 },
      { type: 'open', q: 'What is the main idea of this passage?', idea: 'leaves change color in fall because the tree stops making green chlorophyll, so the hidden colors show' },
    ],
    vocab: { chlorophyll: 'the green material in leaves that uses sunlight to make food', chemical: 'a substance that things are made of', eventually: 'in the end, after some time' },
    circle: { kind: 'idea', prompt: 'Underline the sentence that tells the main idea.', sentences: [
      'Some trees, like maples, also make new red colors.',
      'Leaves change color in fall because trees stop making green chlorophyll, which lets hidden colors show.',
      'Eventually, the leaves dry up and drop.',
      'Chlorophyll is a chemical.'], target: 1 } },

  { id: 'b-f6', level: 55, title: "The Mapmaker's Apprentice",
    text: 'Theo had been the mapmaker\'s apprentice for exactly one week, and so far he had only swept floors and sharpened pencils. On Monday, Master Ines finally handed him a blank sheet of paper. "Draw the path from our shop to the harbor," she said. Theo was confident; he walked that path every day. But when he sat down, his mind went blank. Which came first, the bakery or the bell tower? Embarrassed, he walked the route again, this time counting steps and sketching each landmark in a small notebook. His second map was wobbly, but every turn was correct. Master Ines studied it and nodded. "A good map," she said, "begins with paying attention."',
    questions: [
      { type: 'mc', q: "What was Theo's first real task?", choices: ['draw the path from the shop to the harbor', 'sweep the harbor', 'paint the bell tower'], answer: 0 },
      { type: 'mc', q: 'What did Theo do differently the second time?', choices: ['He counted steps and sketched landmarks.', 'He asked a friend for help.', 'He copied an old map.'], answer: 0 },
      { type: 'open', q: 'What lesson did Theo learn?', idea: 'you have to pay attention to details; a good map begins with paying attention' },
    ],
    vocab: { apprentice: 'someone learning a job from an expert', landmark: 'an easy-to-see place that helps you find your way', confident: 'sure of yourself' },
    circle: { kind: 'idea', prompt: 'Underline the sentence that shows the lesson of the story.', sentences: [
      "Theo had been the mapmaker's apprentice for one week.",
      'Which came first, the bakery or the bell tower?',
      '"A good map begins with paying attention."',
      'His second map was wobbly.'], target: 2 } },

  { id: 'b-g1', level: 60, title: 'The Great Monarch Migration',
    text: 'Each autumn, millions of monarch butterflies begin an astonishing journey. Monarchs that hatch in Canada and the northern United States fly as far as three thousand miles to the mountain forests of central Mexico. What makes this trip so remarkable is that none of these butterflies have ever made it before. The monarchs that left Mexico the previous spring lived short lives, and their great-grandchildren are the ones flying south. Scientists believe the butterflies navigate using the position of the sun and a kind of internal compass that senses Earth\'s magnetic field. Once they arrive, the monarchs cluster together on fir trees by the thousands, covering branches so thickly that the trees appear orange. In spring, they head north again, and the cycle continues.',
    questions: [
      { type: 'mc', q: 'Why is the trip remarkable?', choices: ['None of the butterflies have made it before.', 'It takes ten years.', 'They only fly at night.'], answer: 0 },
      { type: 'mc', q: 'How do scientists think monarchs navigate?', choices: ["the sun's position and an internal compass", 'by following rivers', 'by following birds'], answer: 0 },
      { type: 'open', q: 'Explain why the monarchs flying south are not the same ones that flew north.', idea: 'monarchs live short lives, so a later generation (the great-grandchildren) makes the trip south' },
    ],
    vocab: { migration: 'a long trip animals make from one place to another, often every year', navigate: 'to find the way', astonishing: 'very surprising', cluster: 'to gather close together' },
    circle: { kind: 'word', prompt: 'Circle the word that means "very surprising."', sentence: 'Millions of monarch butterflies begin an astonishing journey.', targets: ['astonishing'] } },

  { id: 'b-g6', level: 65, title: 'The Debate',
    text: 'Ms. Okafor\'s class had to decide how to spend the money they raised at the bake sale: new books for the classroom library or a field trip to the aquarium. Dev argued for the trip. "We\'ll learn about ocean life from real scientists," he said, "and we\'ll remember it for years." Ana disagreed. "A trip lasts one day," she countered, "but books last all year, and next year\'s class can read them too." The room buzzed as students took sides. Finally, Ms. Okafor suggested they look for evidence. They discovered that the aquarium offered a discount for schools and that the public library would lend boxes of books for free. With both facts in hand, the class voted for the trip and borrowed the books. Good research, Ms. Okafor said, can turn an argument into a solution.',
    questions: [
      { type: 'mc', q: "What was Ana's main reason for buying books?", choices: ['Books last all year and other classes can use them.', 'Books are cheaper than snacks.', 'She does not like fish.'], answer: 0 },
      { type: 'mc', q: 'What did the class discover?', choices: ['The aquarium had a school discount and the library lends books free.', 'The bake sale made no money.', 'The aquarium was closed.'], answer: 0 },
      { type: 'open', q: 'What does "good research can turn an argument into a solution" mean in this story?', idea: 'finding facts let them have both: they took the trip and borrowed books, so nobody had to lose' },
    ],
    vocab: { countered: 'answered by giving an opposite idea', evidence: 'facts that help prove something', discount: 'a lower price' },
    circle: { kind: 'idea', prompt: 'Underline the sentence that states the big message (theme).', sentences: [
      'The room buzzed as students took sides.',
      'Dev argued for the trip.',
      'Good research can turn an argument into a solution.',
      'They raised money at the bake sale.'], target: 2 } },

  { id: 'b-h1', level: 70, title: 'Who Invented the Lightbulb?',
    text: 'Ask most people who invented the lightbulb, and they will say Thomas Edison. The real story, however, is more complicated. Decades before Edison, inventors in England and elsewhere had made lamps that glowed when electricity passed through a thin wire, called a filament. The problem was that these early bulbs burned out within minutes or cost far too much to make. Edison\'s team, working in Menlo Park, New Jersey, tested thousands of filament materials, including carbonized bamboo, until they found one that could glow for over a thousand hours. Meanwhile, the British inventor Joseph Swan was developing a similar bulb, and the two eventually joined forces in a company. Edison\'s real achievement may not have been the idea itself, but making the lightbulb practical, affordable, and part of a complete electrical system that could power entire neighborhoods.',
    questions: [
      { type: 'mc', q: 'What was the problem with early bulbs?', choices: ['They burned out fast or cost too much.', 'They were too bright.', 'They used too little electricity.'], answer: 0 },
      { type: 'mc', q: "According to the passage, what was Edison's real achievement?", choices: ['making the bulb practical and part of an electrical system', 'being the first to think of it', 'discovering electricity'], answer: 0 },
      { type: 'open', q: 'Why does the author say the story is "complicated"?', idea: 'many inventors worked on lightbulbs before and at the same time as Edison; he improved it and made it practical rather than inventing it alone' },
    ],
    vocab: { filament: 'the thin wire inside a bulb that glows', decades: 'periods of ten years', practical: 'useful in real life', achievement: 'something done well with effort' },
    circle: { kind: 'idea', prompt: 'Underline the sentence that tells the main idea.', sentences: [
      "Edison's team tested thousands of materials.",
      'Many inventors helped create the lightbulb, and Edison\'s big success was making it practical.',
      'Joseph Swan was a British inventor.',
      'Early bulbs used a filament.'], target: 1 } },

  { id: 'b-h6', level: 75, title: 'The Night Shift',
    text: 'Rosa had always assumed the hospital went to sleep at night, the way her school did. But the first time she visited her mother during the night shift, she discovered a building that hummed like a hive. Nurses glided between rooms carrying clipboards; a man pushed a squeaky cart stacked with fresh sheets; somewhere a monitor beeped in a steady rhythm. Her mother, who at home moved slowly and yawned through breakfast, was transformed here. She spoke quickly and calmly, adjusting an IV bag with one hand while reassuring a frightened patient with the other. Rosa watched from a plastic chair, a cup of hot cocoa cooling in her hands. When her mother finally sat down beside her at three in the morning, Rosa did not complain about being tired. Instead, she asked, "How do you know what everyone needs?" Her mother smiled. "You learn to listen to more than words."',
    questions: [
      { type: 'mc', q: 'What did Rosa assume about the hospital?', choices: ['It went to sleep at night.', 'It was always loud.', 'It had no nurses.'], answer: 0 },
      { type: 'mc', q: 'What does "transformed" tell us about Rosa\'s mother at work?', choices: ['She seemed like a different, energetic person.', 'She was very sleepy.', 'She changed her clothes.'], answer: 0 },
      { type: 'open', q: "Why do you think Rosa didn't complain about being tired?", idea: 'she was impressed by and proud of her mother and understood how hard she works' },
    ],
    vocab: { assumed: 'believed without checking', transformed: 'changed completely', reassuring: 'making someone feel less worried', rhythm: 'a regular, repeated pattern' },
    circle: { kind: 'word', prompt: 'Circle what the hospital is compared to.', sentence: 'She discovered a building that hummed like a hive.', targets: ['hive'] } },
];

const STOPWORDS = new Set(('a an the and or but so of to in on at for with from by is are was were be been am i you he she it we they ' +
  'my your his her its our their me him them us this that these those there here then than as if not no do did does done ' +
  'have has had can could will would should just very too also all some any each into out up down over about after before ' +
  'when what who where why how which said one two').split(' '));

// Flesch-Kincaid grade level, with a simple syllable count.
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length);
}
function readingGrade(text) {
  const ws = words(text), sentences = Math.max(1, (String(text).match(/[.!?]+/g) || []).length);
  if (!ws.length) return 0;
  return 0.39 * ws.length / sentences + 11.8 * ws.reduce((t, w) => t + syllables(w), 0) / ws.length - 15.59;
}

function norm(w) { return String(w).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function words(s) { return String(s).split(/\s+/).filter(Boolean); }
function splitSentences(text) {
  return (String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’']?/g) || [text]).map(s => s.trim()).filter(Boolean);
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Adds the derived tasks (fill in the blank, sentence order) and fills gaps a model may leave.
function preparePassage(p) {
  p = JSON.parse(JSON.stringify(p));
  p.sentences = splitSentences(p.text);
  if (Array.isArray(p.vocab)) p.vocab = Object.fromEntries(p.vocab.filter(v => v && v.word).map(v => [norm(v.word), v.meaning || '']));
  p.vocab = Object.fromEntries(Object.entries(p.vocab || {}).map(([k, v]) => [norm(k), v]));

  // Fill in the blank: prefer a vocabulary word, else a longer content word.
  const vocabKeys = Object.keys(p.vocab);
  const candidates = [];
  p.sentences.forEach((s, si) => words(s).forEach((w, wi) => {
    const n = norm(w);
    if (n.length >= (p.level < 10 ? 3 : 4) && !STOPWORDS.has(n) && !/^[A-Z]/.test(w.replace(/^["“']/, '')) && /^[a-z]+$/.test(n))
      candidates.push({ si, wi, n, score: (vocabKeys.includes(n) ? 10 : 0) + n.length + Math.random() * 3 });
  }));
  candidates.sort((a, b) => b.score - a.score);
  const c = candidates[0];
  if (c) {
    const ws = words(p.sentences[c.si]);
    const m = ws[c.wi].match(/^([^A-Za-z0-9]*)([A-Za-z0-9'’-]+?)([^A-Za-z0-9]*)$/) || ['', '', ws[c.wi], ''];
    p.blank = { before: ws.slice(0, c.wi).join(' ') + ' ' + m[1], answer: m[2], after: m[3] + ' ' + ws.slice(c.wi + 1).join(' '), sentence: p.sentences[c.si] };
  }

  // Sentence order: a run of consecutive sentences from the passage.
  const k = Math.min(levelSpec(p.level).orderCount, p.sentences.length);
  if (k >= 3) {
    const start = Math.floor(Math.random() * (p.sentences.length - k + 1));
    p.order = p.sentences.slice(start, start + k);
  }

  // Circle/underline: keep it only if it can be checked.
  const ci = p.circle;
  const okWord = ci && ci.kind !== 'idea' && ci.sentence && Array.isArray(ci.targets) && ci.targets.length &&
    ci.targets.every(t => words(ci.sentence).some(w => norm(w) === norm(t)));
  const okIdea = ci && ci.kind === 'idea' && Array.isArray(ci.sentences) && ci.sentences[ci.target];
  if (ci && !ci.kind && okWord) ci.kind = 'word';
  if (!okWord && !okIdea) p.circle = fallbackCircle(p);
  return p;
}

function fallbackCircle(p) {
  if (p.mainIdea && p.level >= 40) {
    const others = shuffle(p.sentences.filter(s => norm(s) !== norm(p.mainIdea))).slice(0, 3);
    if (others.length >= 2) {
      const sentences = shuffle([p.mainIdea, ...others]);
      return { kind: 'idea', prompt: 'Underline the sentence that tells the main idea.', sentences, target: sentences.indexOf(p.mainIdea) };
    }
  }
  const s = p.sentences.find(s => words(s).some(w => p.vocab[norm(w)])) || p.sentences.find(s => words(s).length >= 3) || p.sentences[0];
  const target = words(s).map(w => w.replace(/[^A-Za-z0-9'’-]/g, '')).find(w => p.vocab[norm(w)]) ||
    words(s).map(w => w.replace(/[^A-Za-z0-9'’-]/g, '')).sort((a, b) => b.length - a.length)[0];
  return { kind: 'word', prompt: `Circle the word "${target.toLowerCase()}".`, sentence: s, targets: [target] };
}

// The closest built-in passage at or below this level, rotating so repeats are rare.
function builtinFor(level, usedIds = []) {
  const pool = BUILTIN.filter(b => b.level <= level).sort((a, b) => b.level - a.level);
  const near = pool.filter(b => level - b.level < 10);
  const fresh = (near.length ? near : pool).filter(b => !usedIds.includes(b.id));
  const pick = fresh[0] || near[0] || pool[0] || BUILTIN[0];
  return { ...pick, level, source: 'builtin' };
}
