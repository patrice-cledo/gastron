Alright, the main event screen: the recipe display that feels like an Ikea manual and not a sad PDF. This is the thing people will screenshot, share, and secretly feel smart using. Let’s design it precisely so it’s usable, beautiful, and doesn’t turn into wallpaper made of icons.

We’ll cover:

layout anatomy

prefab ingredient system

interaction behavior

accessibility

editing rules

examples of visual patterns

No mystery, no “design by vibes.”

🧩 Core idea

A recipe is shown as a visual sheet made of:

prefab ingredient icons/outlines

arrangement zones

tiny action icons for steps

as little text as possible

User should be able to understand the dish without reading paragraphs. If someone needs a novel, they can buy one.

🖼 Recipe Display Screen (Ikea-style Visual)
Layout structure

Think poster layout, vertically scrollable:

Header strip

Visual recipe canvas (main body)

Footer strip with metadata

1) Header strip (small)

Contains:

Recipe title (center)

Icons row:

time

servings

difficulty dots

optional tag (vegetarian, vegan, spicy, etc.)

No giant text blocks. This is not Medium.com.

2) Visual recipe canvas (the star)

This occupies 80% of the screen.

It contains:

outline shapes for ingredients

labels only where truly necessary

arrangement of food elements in “zones”

subtle section dividers (dashed lines)

tiny pictograms for steps

Examples of structural zones:

“Place here” areas for protein

alignment rows (like shrimp rows in Ikea example)

circular patterns for pizzas/tarts

clusters for chopped elements

Everything is organized, grid-based, and calm.

3) Footer strip

Contains:

Safety icon for oven / heat

Print / share / save buttons

Call to action: “Cook Mode”

Small. Quiet. Polite.

🧱 Prefab ingredients system

We do not reinvent shapes every time like tortured artists. We use prefabs.

Each ingredient type has:

outline icon

fill icon (optional)

size variations

arrangement presets

Ingredient prefab categories
1) Whole items

Used as individual outline shapes:

shrimp

mushrooms

strawberries

olives

meatballs

cookies

dumplings

These go into:

rows

circles

grids

2) Sliced / repeated elements

lemon slices

cucumber coins

tomato slices

onion rings

carrot rounds

Visualization:

thin concentric circles or wedges

stack count communicated visually (like 8 repeated outlines)

3) “Scatter” ingredients

These cannot reasonably be placed piece-by-piece:

minced garlic

salt

grated cheese

pepper flakes

herbs

Representation:

dotted scatter zone

sprinkle cloud icon

area pattern rather than countable shapes

Label beneath:

Sprinkle across this area

Humans should not be placing exactly 247 cheese molecules.

4) Liquids & coatings

olive oil drizzle

sauces

marinades

broths

Visualization:

wave pattern zone

droplet icon

arrow showing pour direction

5) Quantity indicators (text-light)

Instead of heavy text like “1 cup shredded cheese,” use:

small fraction icons (½, 1, 2)

container silhouettes (tablespoon, cup, teaspoon)

nested stacked shapes to indicate “more of this”

Only when ambiguity actually matters.

🎛 Interaction behavior
Tapping ingredients

User taps an ingredient outline:

gets a checkmark overlay

outline thickens slightly

subtle color wash (high contrast)

This answers:

Did I already add the olives or am I hallucinating?

Zooming

pinch-to-zoom enabled

double-tap to focus on zone

snap-back button to full view

Tooltips (optional, not default)

Long-press ingredient:

tooltip card slides up

shows text like:
“8–10 mushroom slices”
“Alternative: zucchini”

Cooking steps representation

No paragraphs. Just pictograms:

fold parchment icon

oven temperature icon

pan on stovetop icon

clock icon

knife chop icon

whisk icon

Under each icon, one tiny caption max.

Example caption:

Bake 20 min at 200°C

Not:

Preheat your childhood home oven that symbolizes emotional warmth blah blah

None of that.

🧭 Layout presets per recipe type

Different recipes benefit from different visual patterns.

Sheet-pan meals

Use:

rectangular pan frame

evenly spaced rows

zones separated with dashed guidelines

Pizza / round tart

Use:

circular central canvas

radial slice markers

topping distribution patterns

Bowls / stir fry

Use:

concentric rings

“build in layers” label icons

Wraps / burritos

Use:

unfolded tortilla outline

ingredient strips arranged across diameter

fold arrows

Skewers / kabobs

Use:

skewer line with repeating shape slots

Humans will instantly recognize the pattern.

♿ Accessibility (we care, begrudgingly)

do not rely on color only

checked ingredients get:

check icon

thicker line

contrast inversion possible

ingredient names available with screen reader

motion-avoidance respects system preference

The app’s whole premise is clarity. It cannot itself be confusing.

🛠 Edit vs View modes

We separate “I’m cooking” from “I’m designing layouts.”

View mode (default)

interactive checkmarks only

no element movement

calm, stable

Edit mode (for your converted recipes)

Users can:

replace ingredient prefab

rotate or mirror clusters

change quantity visually

drag ingredient groups into zones

MVP level editing:

ingredient replace

rename title

adjust servings count

Advanced editing comes later, when you have gray hair.

🧪 Example micro-interactions

sprinkle zone animates with tiny bounce

fold arrows gently pulse

completed ingredient stays visible but subdued

timer icon wiggles when active

Subtle. No Las Vegas energy.

🧭 Information priority (this matters most)

What users must see instantly:

what food goes where

how much of each thing approximately

cook temp and time

fold/bake/steam finishing action

Only then:

nutrition

philosophy

brand voice

sponsor nonsense later

🧨 Things NOT allowed on this screen

long passages of text

autoplay videos

19 different font styles

pop-ups begging for reviews mid-cooking

bright red warning bars for no reason

If it looks overwhelmed, it is.