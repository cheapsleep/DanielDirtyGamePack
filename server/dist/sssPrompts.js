"use strict";
// Scribble Scrabble: Scrambled - Prompt Generation System
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_COUNT = void 0;
exports.generatePromptSet = generatePromptSet;
exports.getUnusedTemplateIndex = getUnusedTemplateIndex;
exports.generatePromptSetFromTemplate = generatePromptSetFromTemplate;
// 30+ prompt templates with scrambled variants
const promptTemplates = [
    {
        base: "A pirate",
        scrambles: [
            "A dentist who thinks he's a pirate",
            "A pirate who's afraid of water",
            "A pirate made entirely of cheese",
            "A pirate at a job interview",
            "A pirate who only steals vegetables"
        ]
    },
    {
        base: "A dragon",
        scrambles: [
            "A dragon with a cold",
            "A dragon who's scared of fire",
            "A dragon working at a coffee shop",
            "A baby dragon learning to fly",
            "A dragon in a business suit"
        ]
    },
    {
        base: "A cat",
        scrambles: [
            "A cat who thinks it's a dog",
            "A cat running for president",
            "A cat made of spaghetti",
            "A cat doing taxes",
            "A cat that's secretly a superhero"
        ]
    },
    {
        base: "A robot",
        scrambles: [
            "A robot having an existential crisis",
            "A robot on a first date",
            "A robot who wants to be a chef",
            "A robot learning to dance",
            "A robot that runs on coffee"
        ]
    },
    {
        base: "A wizard",
        scrambles: [
            "A wizard who forgot all his spells",
            "A wizard at the DMV",
            "A wizard who's allergic to magic",
            "A wizard starting a food truck",
            "A wizard on summer vacation"
        ]
    },
    {
        base: "A cowboy",
        scrambles: [
            "A cowboy at a job interview",
            "A cowboy who's actually a robot",
            "A cowboy afraid of horses",
            "A cowboy in New York City",
            "A cowboy who only rides unicycles"
        ]
    },
    {
        base: "A chef",
        scrambles: [
            "A chef who can't taste anything",
            "A chef cooking in space",
            "A chef who only cooks desserts",
            "A chef fighting a kitchen fire",
            "A chef who's secretly a ninja"
        ]
    },
    {
        base: "A superhero",
        scrambles: [
            "A superhero with a useless power",
            "A superhero on laundry day",
            "A superhero who's afraid of heights",
            "A superhero working a desk job",
            "A superhero whose cape is too long"
        ]
    },
    {
        base: "An alien",
        scrambles: [
            "An alien at a grocery store",
            "An alien trying to blend in",
            "An alien who's lost their spaceship",
            "An alien at a barbecue",
            "An alien who loves country music"
        ]
    },
    {
        base: "A knight",
        scrambles: [
            "A knight stuck in their armor",
            "A knight who's afraid of swords",
            "A knight at a drive-thru",
            "A knight with a pet hamster",
            "A knight who refuses to fight"
        ]
    },
    {
        base: "A detective",
        scrambles: [
            "A detective who's always wrong",
            "A detective afraid of clues",
            "A detective solving a missing sock case",
            "A detective who only works at night",
            "A detective with a magnifying glass addiction"
        ]
    },
    {
        base: "A mermaid",
        scrambles: [
            "A mermaid who can't swim",
            "A mermaid at a water park",
            "A mermaid in the desert",
            "A mermaid applying for legs",
            "A mermaid who hates seafood"
        ]
    },
    {
        base: "A vampire",
        scrambles: [
            "A vampire at the beach",
            "A vampire who's a vegetarian",
            "A vampire at a blood drive",
            "A vampire who sleeps at night",
            "A vampire working as a dentist"
        ]
    },
    {
        base: "A ghost",
        scrambles: [
            "A ghost who's not scary",
            "A ghost at a costume party",
            "A ghost trying to use a phone",
            "A ghost who's afraid of the dark",
            "A ghost learning to haunt"
        ]
    },
    {
        base: "A princess",
        scrambles: [
            "A princess who doesn't want to be rescued",
            "A princess working at a fast food joint",
            "A princess with a pet dragon",
            "A princess who's terrible at waving",
            "A princess training for a marathon"
        ]
    },
    {
        base: "A monkey",
        scrambles: [
            "A monkey in a tuxedo",
            "A monkey doing homework",
            "A monkey who hates bananas",
            "A monkey astronaut",
            "A monkey teaching a class"
        ]
    },
    {
        base: "A dinosaur",
        scrambles: [
            "A dinosaur at a birthday party",
            "A dinosaur learning to type",
            "A dinosaur with tiny arms problems",
            "A dinosaur in modern traffic",
            "A dinosaur who's vegetarian"
        ]
    },
    {
        base: "A clown",
        scrambles: [
            "A clown who's not funny",
            "A clown at a funeral",
            "A clown who's afraid of balloons",
            "A clown doing serious business",
            "A clown with stage fright"
        ]
    },
    {
        base: "A unicorn",
        scrambles: [
            "A unicorn without a horn",
            "A unicorn at the gym",
            "A unicorn who hates rainbows",
            "A unicorn stuck in traffic",
            "A unicorn with a cold"
        ]
    },
    {
        base: "A doctor",
        scrambles: [
            "A doctor afraid of blood",
            "A doctor who forgot medical school",
            "A doctor treating a zombie",
            "A doctor on a coffee break",
            "A doctor who only heals feelings"
        ]
    },
    {
        base: "A penguin",
        scrambles: [
            "A penguin in the tropics",
            "A penguin learning to fly",
            "A penguin at a formal dinner",
            "A penguin who's too hot",
            "A penguin doing ballet"
        ]
    },
    {
        base: "A bear",
        scrambles: [
            "A bear who can't hibernate",
            "A bear at a picnic",
            "A bear in a tiny car",
            "A bear who's afraid of honey",
            "A bear learning yoga"
        ]
    },
    {
        base: "A witch",
        scrambles: [
            "A witch with a broken broomstick",
            "A witch who's allergic to black cats",
            "A witch at a beauty salon",
            "A witch learning technology",
            "A witch who only does good spells"
        ]
    },
    {
        base: "An astronaut",
        scrambles: [
            "An astronaut who forgot their helmet",
            "An astronaut afraid of space",
            "An astronaut eating in zero gravity",
            "An astronaut lost in IKEA",
            "An astronaut on a Zoom call"
        ]
    },
    {
        base: "A dog",
        scrambles: [
            "A dog at a cat convention",
            "A dog who can't fetch",
            "A dog running a business",
            "A dog with a secret identity",
            "A dog who's scared of bones"
        ]
    },
    {
        base: "A ninja",
        scrambles: [
            "A ninja who's very loud",
            "A ninja at a disco",
            "A ninja afraid of the dark",
            "A ninja on vacation",
            "A ninja who trips a lot"
        ]
    },
    {
        base: "A farmer",
        scrambles: [
            "A farmer afraid of animals",
            "A farmer in a submarine",
            "A farmer growing money",
            "A farmer with robot cows",
            "A farmer who's never seen a plant"
        ]
    },
    {
        base: "A scientist",
        scrambles: [
            "A scientist whose experiment went wrong",
            "A scientist afraid of test tubes",
            "A scientist inventing useless things",
            "A scientist at a magic show",
            "A scientist who can't do math"
        ]
    },
    {
        base: "A king",
        scrambles: [
            "A king who lost his crown",
            "A king at a fast food restaurant",
            "A king who's afraid of his throne",
            "A king doing his own laundry",
            "A king who can't make decisions"
        ]
    },
    {
        base: "A fish",
        scrambles: [
            "A fish out of water",
            "A fish driving a car",
            "A fish at a sushi restaurant",
            "A fish who can't swim",
            "A fish wearing a top hat"
        ]
    },
    {
        base: "A snowman",
        scrambles: [
            "A snowman at the beach",
            "A snowman in summer",
            "A snowman with no nose",
            "A snowman at the gym",
            "A snowman afraid of children"
        ]
    },
    {
        base: "A teacher",
        scrambles: [
            "A teacher who forgot everything",
            "A teacher herding cats",
            "A teacher grading papers at 3am",
            "A teacher with superpowers",
            "A teacher who only teaches naps"
        ]
    }
];
/**
 * Generate a set of prompts for a game round
 * @param playerCount Number of players (must be >= 3)
 * @returns Object with realPrompt and array of scrambled variants
 */
function generatePromptSet(playerCount) {
    if (playerCount < 3) {
        throw new Error('Scribble Scrabble: Scrambled requires at least 3 players');
    }
    // Pick a random template
    const templateIndex = Math.floor(Math.random() * promptTemplates.length);
    const template = promptTemplates[templateIndex];
    // Shuffle the scrambles and pick enough for other players (playerCount - 1)
    const shuffledScrambles = [...template.scrambles].sort(() => Math.random() - 0.5);
    const neededVariants = playerCount - 1;
    // If we don't have enough variants, repeat some (shouldn't happen with 5+ variants each)
    const variants = [];
    for (let i = 0; i < neededVariants; i++) {
        variants.push(shuffledScrambles[i % shuffledScrambles.length]);
    }
    return {
        realPrompt: template.base,
        variants
    };
}
/**
 * Get a list of used template indices for a game to avoid repeats
 * @param usedIndices Set of already used template indices
 * @returns A new template index that hasn't been used
 */
function getUnusedTemplateIndex(usedIndices) {
    const availableIndices = promptTemplates
        .map((_, index) => index)
        .filter(index => !usedIndices.has(index));
    if (availableIndices.length === 0) {
        // All templates used, reset and pick randomly
        return Math.floor(Math.random() * promptTemplates.length);
    }
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
}
/**
 * Generate a prompt set from a specific template index
 * @param templateIndex The template index to use
 * @param playerCount Number of players
 * @returns Object with realPrompt and array of scrambled variants
 */
function generatePromptSetFromTemplate(templateIndex, playerCount) {
    const template = promptTemplates[templateIndex % promptTemplates.length];
    const shuffledScrambles = [...template.scrambles].sort(() => Math.random() - 0.5);
    const neededVariants = playerCount - 1;
    const variants = [];
    for (let i = 0; i < neededVariants; i++) {
        variants.push(shuffledScrambles[i % shuffledScrambles.length]);
    }
    return {
        realPrompt: template.base,
        variants
    };
}
exports.TEMPLATE_COUNT = promptTemplates.length;
