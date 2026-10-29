// Curated content for Word Work sheets. Every answer here is written by hand so it is always right;
// the story writer only writes the stories. One entry per band (letter A–H).
// Words: "word|part of speech|meaning|example sentence" (n noun, v verb, adj adjective, adv adverb).
const WORD_BANK = [
  { // A
    words: `cat|n|a small furry pet that says meow|The cat sat on the mat.
dog|n|a pet that barks|The dog ran to me.
sun|n|the big hot star in the sky|The sun is hot.
hat|n|something you wear on your head|I have a red hat.
bed|n|where you sleep at night|I go to bed.
pig|n|a farm animal that says oink|The pig is in the mud.
bus|n|a big car that takes many people|We ride the bus.
cup|n|you drink from it|The cup is full.
hop|v|to jump on one foot or like a frog|The frog can hop.
run|v|to move fast on your feet|I run to the park.
sit|v|to rest on a chair|Sit on the rug.
dig|v|to make a hole in the dirt|The dog likes to dig.
big|adj|large, not small|That is a big box.
red|adj|the color of a ripe apple|I see a red ball.
hot|adj|very warm|The soup is hot.
wet|adj|covered with water|The dog is wet.
map|n|a picture that shows where places are|Look at the map.
fox|n|a wild animal with a bushy tail|The fox ran fast.
nut|n|a seed with a hard shell|The squirrel has a nut.
web|n|what a spider makes|A bug is in the web.`,
    sentences: `The cat is big.|.
I see a red hat.|.
Can the frog hop?|?
The sun is hot!|!
Sam has a dog.|.
Is the bed wet?|?
We can run fast.|.
Look at the big pig!|!`,
  },
  { // B
    words: `frog|n|a small green animal that hops and swims|The frog sat on a log.
ship|n|a very big boat|The ship sailed away.
chick|n|a baby chicken|The chick says peep.
truck|n|a big car that carries heavy things|The truck is full of sand.
nest|n|a home that birds build|Three eggs are in the nest.
duck|n|a bird that swims and quacks|The duck swam in the pond.
pond|n|a small lake|Fish live in the pond.
lunch|n|the meal you eat in the middle of the day|We ate lunch at noon.
jump|v|to push off the ground into the air|I can jump high.
swim|v|to move through water|Fish swim in the sea.
stop|v|to not go anymore|Stop at the red light.
clap|v|to hit your hands together|Clap your hands.
fast|adj|quick, not slow|The cat is fast.
soft|adj|nice to touch, not hard|The bed is soft.
glad|adj|happy|I am glad you came.
sick|adj|not well|He was sick in bed.
plant|n|something green that grows in dirt|The plant needs water.
shell|n|a hard cover, like on a snail|I found a shell at the beach.
crab|n|a sea animal that walks sideways|The crab hid in the sand.
drum|n|something you hit to make music|He plays the drum.`,
    sentences: `The frog sat on a log.|.
Did you see the ship?|?
What a big truck!|!
The duck can swim.|.
Can we stop for lunch?|?
The chick is so soft!|!
Jen and Max clap.|.
Where is the nest?|?`,
  },
  { // C
    words: `rain|n|water that falls from clouds|The rain made a puddle.
train|n|cars that ride on a track|The train is long.
boat|n|something that floats and carries people on water|We rowed the boat.
smile|v|to make a happy face|She smiled at me.
bake|v|to cook in an oven|We bake a cake.
float|v|to stay on top of water|The leaf floats on the pond.
dream|n|pictures you see when you sleep|I had a good dream.
night|n|the dark time when we sleep|The stars shine at night.
puddle|n|a small pool of water on the ground|He jumped in the puddle.
garden|n|a place where plants and flowers grow|We planted beans in the garden.
happy|adj|feeling good|The puppy is happy.
sleepy|adj|ready to sleep|I feel sleepy.
bright|adj|full of light|The sun is bright.
quiet|adj|making little or no sound|The library is quiet.
farmer|n|a person who grows food or raises animals|The farmer feeds the cows.
corner|n|the place where two sides meet|The cat sat in the corner.
window|n|glass in a wall that lets in light|Look out the window.
little|adj|small|A little bird sang.
folded|v|bent paper or cloth over itself|She folded the paper.
painted|v|put paint on something|We painted the fence.
write|v|to put words on paper|I write my name.
think|v|to use your mind|I think it will be sunny.
bring|v|to carry something with you|Bring your coat to school.`,
    sentences: `The train went up the hill.|.
Did it rain last night?|?
What a bright day!|!
Mom baked a cake for me.|.
Can a boat float in a puddle?|?
I had the best dream!|!
The farmer has six cows.|.
Why is the garden so quiet?|?`,
  },
  { // D
    words: `insect|n|a small animal with six legs|An ant is an insect.
nectar|n|a sweet juice made by flowers|Bees drink nectar.
hive|n|the home where bees live|The hive was full of honey.
experiment|n|a test to find something out|We did an experiment with ice.
notebook|n|a book of blank pages to write in|She wrote in her notebook.
explain|v|to tell how or why something happens|Can you explain the game?
collect|v|to gather things together|I collect shells.
discover|v|to find something new|They discovered a cave.
careful|adj|paying attention so nothing goes wrong|Be careful with the glass.
shiny|adj|bright and smooth|She has a shiny coin.
gentle|adj|soft and kind|Be gentle with the kitten.
noisy|adj|loud|The class was noisy.
sunflower|n|a tall flower with a big yellow head|The sunflower grew tall.
rainbow|n|bands of color in the sky after rain|We saw a rainbow.
results|n|what you find out at the end|We wrote down our results.
slowly|adv|not fast|The turtle walked slowly.
quickly|adv|fast|She quickly ran home.
weather|n|what it is like outside: sunny, rainy, windy|The weather is cold today.
journey|n|a trip from one place to another|It was a long journey.
melt|v|to turn from solid to liquid|Ice melts in the sun.`,
    sentences: `Bees drink nectar from flowers.|.
Have you ever seen a rainbow?|?
Wow, the ice melted so fast!|!
Priya wrote the results in her notebook.|.
How do bees make honey?|?
Be careful with that glass!|!
The turtle walked slowly to the pond.|.
What did you discover in the cave?|?`,
  },
  { // E
    words: `soil|n|dirt where plants grow|Plant the seeds in soft soil.
crowded|adj|very full of people or things|The bus was crowded.
loosen|v|to make less tight or hard|Loosen the lid of the jar.
keeper|n|a person who takes care of a place|The zoo keeper fed the lions.
drifting|v|moving slowly with the water or wind|The boat was drifting away.
steer|v|to turn a boat or car to go a certain way|Steer the bike around the rock.
scratch|v|to rub with claws or nails|The cat scratched the door.
harvest|n|the time when crops are gathered|We picked apples at harvest.
recipe|n|steps that tell you how to cook something|Follow the recipe to bake bread.
fragile|adj|easy to break|The glass vase is fragile.
enormous|adj|very, very big|An elephant is enormous.
cautious|adj|careful to avoid danger|The deer was cautious near the road.
whisper|v|to talk very softly|She whispered a secret.
tumble|v|to fall and roll over|The ball tumbled down the hill.
ancient|adj|very, very old|They found an ancient coin.
gather|v|to bring together|Gather the eggs from the hens.
shelter|n|a place that keeps you safe from weather|We waited in the shelter.
musician|n|a person who plays music|The musician played the violin.
victory|n|winning|The team cheered for their victory.
curious|adj|wanting to know or learn|The curious kitten sniffed the box.
borrow|v|to take something and give it back later|Can I borrow your pencil?
explore|v|to look around a new place|We explored the forest trail.`,
    sentences: `The lighthouse keeper climbed the stairs.|.
Why was the bus so crowded?|?
What an enormous whale!|!
Grandpa loosened the soil with a shovel.|.
Did you follow the recipe?|?
Watch out, that vase is fragile!|!
The boat was drifting toward the rocks.|.
Where did they find the ancient coin?|?`,
  },
  { // F
    words: `chlorophyll|n|the green material in leaves that uses sunlight to make food|Chlorophyll makes leaves green.
eventually|adv|in the end, after some time|Eventually, the rain stopped.
apprentice|n|someone learning a job from an expert|The apprentice watched the baker.
landmark|n|an easy-to-see place that helps you find your way|The tower is a famous landmark.
confident|adj|sure of yourself|She felt confident before the test.
embarrassed|adj|feeling silly in front of others|He was embarrassed when he tripped.
route|n|the way you go from one place to another|We took the long route home.
observe|v|to watch carefully|Observe how the ants carry food.
predict|v|to say what you think will happen|Can you predict the ending?
reluctant|adj|not wanting to do something|He was reluctant to jump in the cold lake.
generous|adj|happy to give or share|She is generous with her snacks.
habitat|n|the natural home of a plant or animal|A pond is a frog's habitat.
volunteer|v|to offer to help without being asked|I volunteer to clean up.
determined|adj|not giving up|She was determined to finish the race.
fascinating|adj|very interesting|The museum was fascinating.
summary|n|a short telling of the main points|Write a summary of the story.
ordinary|adj|normal, not special|It was an ordinary day.
recover|v|to get better|He recovered from his cold.
appear|v|to come into sight|Stars appear at night.
compare|v|to see how things are alike and different|Compare the two leaves.`,
    sentences: `Eventually, the leaves dry up and fall.|.
Can you predict what happens next?|?
What a fascinating museum!|!
The apprentice swept the floor of the shop.|.
Which route goes to the harbor?|?
I can't believe she finished first!|!
A pond is a habitat for frogs and fish.|.
Why was Theo reluctant to draw the map?|?`,
  },
  { // G
    words: `migration|n|a long trip animals make, often every year|The geese began their migration south.
navigate|v|to find the way|Sailors navigate by the stars.
astonishing|adj|very surprising|The magician did an astonishing trick.
cluster|v|to gather close together|The bees cluster around the queen.
evidence|n|facts that help prove something|The muddy footprints were evidence.
discount|n|a lower price|The store gave us a discount.
countered|v|answered by giving an opposite idea|She countered his idea with her own.
debate|n|a talk where people give reasons for different sides|The class had a debate about recess.
efficient|adj|working well without wasting time|The new oven is efficient.
persuade|v|to get someone to agree|He tried to persuade me to play.
consequence|n|what happens because of something|Being late had a consequence.
remarkable|adj|worth noticing; unusual|She has a remarkable memory.
temporary|adj|lasting only a short time|The tent was a temporary home.
abundant|adj|more than enough|Food was abundant at the feast.
conclude|v|to decide after thinking|We conclude that plants need light.
inhabit|v|to live in a place|Penguins inhabit cold places.
resource|n|something useful that people can use|Water is an important resource.
vibrant|adj|bright and full of life|The garden was vibrant with flowers.
negotiate|v|to talk to reach an agreement|They negotiated who would go first.
perspective|n|a way of seeing things|Try to see it from her perspective.`,
    sentences: `Monarch butterflies make a long migration every fall.|.
What evidence did the class find?|?
What an astonishing journey!|!
Dev tried to persuade the class to vote for the trip.|.
How do butterflies navigate so far?|?
That is a remarkable idea!|!
Water is an important resource for every living thing.|.
Which side of the debate do you agree with?|?`,
  },
  { // H
    words: `filament|n|the thin wire inside a bulb that glows|The filament glowed orange.
decade|n|a period of ten years|The town grew over a decade.
practical|adj|useful in real life|Boots are practical in the snow.
achievement|n|something done well with effort|Finishing the book was an achievement.
assumed|v|believed without checking|I assumed the store was open.
transformed|v|changed completely|The caterpillar transformed into a butterfly.
reassuring|adj|making someone feel less worried|Her smile was reassuring.
rhythm|n|a regular, repeated pattern of sounds|Clap to the rhythm of the song.
complicated|adj|having many parts; hard to understand|The puzzle was complicated.
affordable|adj|cheap enough to buy|The bike was affordable.
illuminate|v|to light up|Lamps illuminate the street.
endurance|n|the strength to keep going a long time|Running far takes endurance.
anticipate|v|to expect something will happen|We anticipate rain tomorrow.
reluctance|n|not wanting to do something|She showed reluctance to leave.
contradict|v|to say the opposite of something|The facts contradict his story.
meticulous|adj|very careful about every detail|He kept meticulous notes.
inevitable|adj|sure to happen|Change is inevitable.
collaborate|v|to work together|The students collaborate on a project.
significant|adj|important; large enough to matter|It was a significant discovery.
skeptical|adj|not easily believing something|She was skeptical of the rumor.`,
    sentences: `Edison's team tested thousands of materials.|.
Who really invented the lightbulb?|?
What a complicated story it turned out to be!|!
Rosa assumed the hospital slept at night.|.
How did the bulb become affordable for families?|?
That was a remarkable achievement!|!
The nurses worked through the night with meticulous care.|.
Why was Rosa skeptical at first?|?`,
  },
];

// Rhyming word families for the early bands.
const WORD_FAMILIES = ['cat hat bat mat rat', 'can man fan pan ran', 'big pig dig wig', 'hop mop top pop', 'bug hug mug rug',
  'hen ten pen men', 'bed red fed', 'sun run fun bun', 'cake lake make bake', 'night light right bright', 'ring sing king wing',
  'day play say way', 'rain train main pain', 'bell tell well shell', 'sock rock clock block', 'fish dish wish', 'boat coat goat'];

const SYNONYMS = ['big large', 'small little', 'happy glad', 'fast quick', 'begin start', 'shout yell', 'angry mad', 'smart clever',
  'scared afraid', 'tired sleepy', 'close shut', 'look see', 'gift present', 'finish end', 'enormous huge', 'quiet silent',
  'brave fearless', 'ancient old', 'collect gather', 'difficult hard'];
const ANTONYMS = ['big small', 'hot cold', 'up down', 'happy sad', 'fast slow', 'open close', 'day night', 'wet dry', 'full empty',
  'early late', 'loud quiet', 'push pull', 'win lose', 'heavy light', 'ancient modern', 'generous selfish', 'remember forget',
  'brave cowardly', 'arrive leave', 'temporary permanent'];
const PLURALS = ['cat cats', 'dog dogs', 'box boxes', 'fox foxes', 'dish dishes', 'bus buses', 'baby babies', 'puppy puppies',
  'leaf leaves', 'wolf wolves', 'mouse mice', 'child children', 'foot feet', 'tooth teeth', 'man men', 'sheep sheep', 'berry berries', 'wish wishes'];
const PAST = ['jump jumped', 'play played', 'look looked', 'bake baked', 'hop hopped', 'stop stopped', 'cry cried', 'run ran', 'sit sat',
  'eat ate', 'go went', 'see saw', 'swim swam', 'take took', 'make made', 'sing sang', 'write wrote', 'find found'];
const COMPOUNDS = ['sun flower sunflower', 'rain bow rainbow', 'cup cake cupcake', 'foot ball football', 'star fish starfish',
  'pop corn popcorn', 'back pack backpack', 'tooth brush toothbrush', 'snow man snowman', 'bed room bedroom', 'butter fly butterfly', 'fire fly firefly'];
const CONTRACTIONS = ["do not|don't", "can not|can't", "is not|isn't", "I am|I'm", "it is|it's", "you are|you're", "we will|we'll",
  "they are|they're", "did not|didn't", "she is|she's", "would not|wouldn't", "have not|haven't"];
const AFFIXES = ['un|happy|not happy', 're|read|read again', 'un|lock|open the lock', 'pre|heat|heat before', 'dis|agree|not agree',
  'mis|spell|spell wrong', 'help|ful|full of help', 'care|less|without care', 'kind|ness|being kind', 'teach|er|a person who teaches',
  'quick|ly|in a quick way', 'end|less|without an end', 'over|cook|cook too much', 'im|possible|not possible'];
const FACT_OPINION = ['Bees make honey.|fact', 'Honey is the best food.|opinion', 'A spider has eight legs.|fact', 'Spiders are scary.|opinion',
  'The sun rises in the east.|fact', 'Sunsets are beautiful.|opinion', 'Water freezes when it is very cold.|fact', 'Winter is the most fun season.|opinion',
  'A week has seven days.|fact', 'Saturday is the best day.|opinion', 'Monarch butterflies migrate to Mexico.|fact', 'Butterflies are prettier than moths.|opinion'];
const FIGURATIVE = ['The hall was as quiet as a mouse.|simile', 'Her smile was as bright as the sun.|simile', 'He ran like the wind.|simile',
  'The classroom was a zoo.|metaphor', 'Time is a thief.|metaphor', 'Her voice was music to my ears.|metaphor',
  'The cat slept on the warm rug.|neither', 'We ate lunch at noon.|neither', 'The snow was a white blanket on the hills.|metaphor', 'The baby slept like a log.|simile'];

function bankWords(band) {
  return WORD_BANK[band].words.trim().split('\n').map(l => { const [w, pos, def, ex] = l.split('|'); return { w, pos, def, ex }; });
}
function bankSentences(band) {
  return WORD_BANK[band].sentences.trim().split('\n').map(l => { const [s, mark] = l.split('|'); return { s, mark }; });
}
