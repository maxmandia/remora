export const creativeCategories = ["film", "ads", "art"] as const;

export type CreativeCategory = (typeof creativeCategories)[number];

type CreativeCategoryDetails = {
  description: string;
  eyebrow: string;
  label: string;
  subtitle: string;
  title: string;
  videoUrl: string;
};

export const creativeCategoryDetails: Record<
  CreativeCategory,
  CreativeCategoryDetails
> = {
  film: {
    description:
      "Shape cinematic moments, narrative worlds, and moving images built around a strong point of view.",
    eyebrow: "Stories in motion",
    label: "Film",
    subtitle: "Explore stories",
    title: "Build a world worth watching.",
    videoUrl: new URL("../../assets/film.mp4", import.meta.url).href,
  },
  ads: {
    description:
      "Turn a product, message, or idea into campaign-ready concepts with a clear visual hook.",
    eyebrow: "Ideas with impact",
    label: "Ads",
    subtitle: "Explore campaigns",
    title: "Make the first second count.",
    videoUrl: new URL("../../assets/ads.mp4", import.meta.url).href,
  },
  art: {
    description:
      "Experiment with form, color, texture, and style to find an image language that feels entirely your own.",
    eyebrow: "Visual experiments",
    label: "Art",
    subtitle: "Explore visuals",
    title: "Follow the image somewhere new.",
    videoUrl: new URL("../../assets/art.mp4", import.meta.url).href,
  },
};

export function isCreativeCategory(value: string): value is CreativeCategory {
  return creativeCategories.some((category) => category === value);
}

export type ExploreVhsTapeDetails<TKey extends string = string> = {
  description: string;
  duration: number;
  key: TKey;
  modelId: string;
  prompt: string;
  resolution: string;
  title: string;
  videoUrl: string;
};

const exploreVhsTapeGenerationDefaults = {
  duration: -1,
  modelId: "seedance-2.0-video",
  resolution: "1080p",
} as const;

const exploreFilmVideoBaseUrl =
  "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/film";
const exploreAdsVideoBaseUrl =
  "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/ads";

export const exploreVhsTapes = [
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "Dozens of colorful balloons rise above misty hills as the camera reveals the sunrise landscape.",
    key: "78bd92a0",
    prompt:
      "A hot air balloon festival at sunrise, dozens of colorful balloons rising above misty green hills, camera tilts up slowly revealing the vast landscape.",
    title: "Sky at Sunrise",
    videoUrl: `${exploreFilmVideoBaseUrl}/hot-air-balloon-festival.mp4`,
  },

  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A sunlit meadow, soft bokeh, and natural puppy motion captured in a smooth tracking shot.",
    key: "55caffe6",
    prompt:
      "A golden retriever puppy chasing butterflies through a sunlit meadow, soft bokeh background, cinematic camera slowly tracking the puppy.",
    title: "Butterfly Chase",
    videoUrl: `${exploreFilmVideoBaseUrl}/golden-retriever-butterflies.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "An overhead close-up captures precise handwork, warm restaurant light, and curls of steam.",
    key: "cde60c73",
    prompt:
      "A sushi chef carefully preparing an intricate sushi roll, close-up overhead shot, steam rising, warm restaurant lighting.",
    title: "Chef's Precision",
    videoUrl: `${exploreFilmVideoBaseUrl}/sushi-chef-roll.mp4`,
  },

  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "Wind drives a flowing red dress and loose hair against a wide, golden-hour seascape.",
    key: "d2b99cf2",
    prompt:
      "A woman in a flowing red dress walking along the edge of a cliff overlooking the sea, wind blowing her hair and dress, dramatic wide angle, golden sunset.",
    title: "Red Dress, Gold Light",
    videoUrl: `${exploreFilmVideoBaseUrl}/red-dress-cliff.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "Two stations tear apart above Earth in a tumbling field of debris, fire, and crystallizing atmosphere.",
    key: "ebf8bb42",
    prompt:
      "A catastrophic collision between two massive space stations in low Earth orbit. Metal shears apart in slow motion as the stations grind into each other, sending a hailstorm of debris spiraling outward. Entire modules crumple like tin cans. Pressurized compartments blow out in violent bursts of crystallizing atmosphere. Solar panels shatter and cartwheel into the void. The camera tumbles through the wreckage as an astronaut ragdolls past, arms flailing. Explosions ripple down the station spine. Earth looms enormous in the background, serene and indifferent. Hyper-realistic, catastrophic scale, ISO debris field, 8k, Gravity collision sequence energy.",
    title: "Orbital Collision",
    videoUrl: `${exploreFilmVideoBaseUrl}/space-station-collision.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A single handheld move follows a singer from her dressing room through backstage and into a packed arena.",
    key: "32d81c14",
    prompt:
      "One-take handheld gimbal tracking shot. The camera slowly pushes in through a gap in a heavy red curtain and enters a warm-toned backstage dressing room. A young female singer, with her back to the camera, is adjusting her earpiece as a staff member reminds her it's time to go on. She turns toward the camera and starts singing citypop. The camera pulls back and tracks her as she passes through the curtain into a dim backstage corridor, interacting naturally with her dancers along the way; one staff member hands her a microphone. She and the dancers then step onto the stage, and the camera arcs around to the back, gradually revealing the red-and-black stage design, LED screens, spotlights, haze, and reflective floor. The camera finally pulls out to a wide shot of the arena, showing the packed audience, light boards, glow sticks, and cheering crowd, capturing the youthful, free-spirited climax of the concert.",
    title: "Backstage to Arena",
    videoUrl: `${exploreFilmVideoBaseUrl}/backstage-singer-one-take.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "One figure crosses six connected rooms as each space shifts style, emotion, lighting, and physical rules.",
    key: "25864e18",
    prompt:
      'One continuous take. The camera smoothly follows a person in a black coat (reference @image1) moving left to right through six connected rooms of different tones and moods. Every room shares the same structure: white walls, light herringbone wood floor, French floor-to-ceiling windows, white sheer curtains (reference @image2) but the outside view and mood differ each time. The protagonist walks at a constant pace, passing through every open door. 0-5s room one, American-comic fight: the protagonist fights a character (@image3), who is defeated; 5-10s room two, warmth, felt-craft style, window view a sunflower field (@image4), warm-orange soft light, a painter painting sunflowers (@image5), the protagonist turning felt-style on entering; 10-15s room three, sorrow, black-and-white comic stop-motion, rain outside, cold-grey light, a person alone on the floor hugging their knees, a phone glowing with an unanswered call; on entering, the light blinks off then on, the room turns color, flowers bursting into bloom; 15-20s room four, joy, a room submerged in the sea (reference @image6), the protagonist turning transparent among coral and fish; 20-25s room five, surprise, window view a sky of fireworks (reference @image7), colorful flickering light, the protagonist swept up in a cheering crowd; 25-30s a blank white room, the protagonist snaps their fingers — snap SFX — frame goes black, "seedance" in the middle (reference @image8). Cinematic quality, high-fashion advertising style, lighting entirely determined by the window views for strong emotional contrast, no text in frame.',
    title: "Six Rooms",
    videoUrl: `${exploreFilmVideoBaseUrl}/six-room-one-take.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A carrier-deck camera tracks a fighter jet through steam, afterburner glow, and a sunset launch.",
    key: "37990041",
    prompt:
      "A fighter jet launches from an aircraft carrier at sunset. The catapult fires and the jet accelerates from zero to 170mph in two seconds, afterburners blazing blue-white. Steam erupts from the catapult track. The camera follows from the deck as the jet clears the bow and drops slightly before climbing steeply into the orange sky, leaving twin contrails. Deck crew brace against the jet blast. The ocean stretches to the horizon. Hyper-realistic, Top Gun cinematography, 8k, the screaming roar of twin turbofan engines and the metallic slam of the catapult.",
    title: "Carrier Launch",
    videoUrl: `${exploreFilmVideoBaseUrl}/fighter-jet-carrier-launch.mp4`,
  },
] as const satisfies readonly ExploreVhsTapeDetails[];

export const exploreAdsVhsTapes = [
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "Three warm, tactile coffee beats resolve into a calm premium brand lockup.",
    key: "a195f3c1",
    prompt:
      'A spec ad for a kraft-paper coffee bag, built as three cuts in one take. Open on a close-up of beans tumbling into a grinder, then cut to a barista\'s hands tamping a portafilter on a wooden counter, then cut to a finished flat white sliding across the bar toward the camera. Warm side light, shallow focus throughout, a calm unhurried pace. On the final shot, the words "SLOW MORNINGS" fade up in the lower third in a thin serif, dark brown against the cream foam. Audio: the grind, the hiss of steam, a low acoustic guitar, no voiceover.',
    title: "Slow Mornings",
    videoUrl: `${exploreAdsVideoBaseUrl}/coffee-bag-spec-ad.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "Condensation, spray, and brushed aluminum turn a tab pop into a premium beverage hero.",
    key: "b7e4182d",
    prompt:
      'A hero spot for a canned sparkling grapefruit soda. The chilled can sits on a wet black stone slab, beads of condensation sliding down the aluminium, then a hand enters frame and pops the tab with a sharp hiss as a fine spray lifts off the opening. The camera holds a tight macro on the can and pushes in slowly as the spray settles, studio lighting with a hard rim light catching the water droplets and the brushed metal. Clean premium product-ad look, cool desaturated grade with the grapefruit-pink label staying vivid. Once the can settles, the words "CRACK SOMETHING BRIGHT" fade up in the lower third in a tight modern sans-serif. Audio: the crisp pop of the tab, the fizz settling, a single low bass note, no voiceover.',
    title: "Crack Something Bright",
    videoUrl: `${exploreAdsVideoBaseUrl}/grapefruit-soda-hero.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A casual phone-shot testimonial pairs natural dialogue with a clean product insert.",
    key: "c2d906af",
    prompt:
      'A UGC-style ad shot on a phone, vertical framing. A woman in her late twenties sits on a sunlit sofa holding a small amber skincare bottle, talking straight to camera with the easy energy of a creator. She says: "I\'m not going to pretend three drops changed my life, but my skin stopped freaking out, so." She gives a small shrug and a half-smile on the last word. Slightly handheld, natural window light, the warm faintly oversaturated look of a good phone camera, no studio polish. Cut to a two-second insert of her hands shaking the bottle and a single drop landing on a fingertip, then back to her face. Audio: her voice clear and casual, light room tone, a soft lo-fi beat low in the mix.',
    title: "Three Drops",
    videoUrl: `${exploreAdsVideoBaseUrl}/skincare-testimonial-ugc.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A parched desert lizard unleashes a grapefruit tsunami in a playful animated spot.",
    key: "d84a70e3",
    prompt:
      'A 3D animated commercial style, bright and translucent colors; the pulp and juice must feel intensely refreshing and impactful. The overall vibe is like a high-quality commercial animated short with a touch of exaggerated humor. The desert horned lizard character is cute, lively and expressive, reference @image1. The image texture references that soft natural light, delicate fuzz/skin texture, dreamy macro depth of field, and a realistic-yet-slightly-childlike feel from the reference image. 0-3s: a desert scorched by the blazing sun, the air shimmering with heat and the sand searing hot; a desert horned lizard lies on the scalding sand, tongue slightly out, eyes glazed, nearly dried out, swaying with every couple of steps as if about to "evaporate". 3-6s: it suddenly stops, its nose twitches, and looking down it spots a cool, plump, dew-covered grapefruit half-buried in the sand, glistening like a desert miracle; the lizard\'s eyes go wide in an instant. 6-8s: it pounces over, hugging the grapefruit tightly with both hands, pressing its whole face against the rind with a blissful "I\'m finally alive" expression; the frame holds for 1 second, forming an exaggerated, funny memory beat. 8-11s: it looks up, opens its mouth and takes a big bite; the grapefruit rind splits open, the plump pulp shining with a translucent gloss, and the next moment the juice erupts like a tsunami. 11-16s: orange-pink, translucent, glistening grapefruit juice gushes out wildly, pouring down the dunes and rapidly flooding the entire desert; the dry yellow sand instantly turns into a cool, sparkling, fruit-scented summer sea, cacti, rocks and small dunes swallowed by the waves of juice, the lizard\'s expression turning from delight to terror. 16-20s: nearly drowned by the "grapefruit sea", it frantically clutches half a grapefruit like a life buoy and floats, poking its soaked head out looking dazed. 20-24s: cut to a white screen; the brand name and slogan appear dead-center: "Seedance Grapefruit — bite in for the pulp, what pours out is summer." The voiceover reads the whole line. 24-30s: cut back from white; the desert horned lizard is now lounging on the floating grapefruit, wearing tiny sunglasses and holding a cup with a straw, drifting leisurely on the "juice sea" on vacation, surrounded by floating orange pulp, little ice cubes, cool splashes and a clear blue sky; the mood shifts from "survival" to "vacation", and finally it leans back contentedly on the grapefruit as the camera pulls out and freezes on a refreshing, bright, playful summer frame.',
    title: "Summer Pours Out",
    videoUrl: `${exploreAdsVideoBaseUrl}/grapefruit-lizard-3d.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "Four fruit flavors race through geometric, beat-synced product choreography.",
    key: "e31cb569",
    prompt:
      'A bright, colorful commercial style with fruity cookies as the hero, in four flavors — strawberry, apple, grape, and orange; strawberry flavor reference @image1. The cookies and their matching fruits are arranged in a strongly ordered geometric array; the overall frame is clean, premium, and high-energy. It opens with the fruits orbiting rapidly around the central cookie to quickly establish visual focus — reference the composition of @video1 — cutting in on a strong musical beat. Then cookies of different flavors advance toward the lens along spiral paths, forming clear spatial depth — reference the motion and camera work of @video2 — switching colors and flavors on the beat with the background music. The array of cookies pans left and right with fast plane-to-plane cuts, strawberry, apple, grape, and orange flavors alternating as the frame jump-cuts quickly to the rhythm — reference the movement of @video3. The mid-section adds up-and-down panning; the neat cookie array rises and falls vertically like a machine — reference the movement of @video4 — highlighting the beauty of order and the richness of the product. In the climax a cookie is snapped in two and the moment enters slow motion as the fruity filling bursts open, crumbs scattering, the juicy sensation and grainy impact amplified — reference the explosion effect of @video5 — then quickly returns to the fast-paced edit. The ending brings in the English text "Fresh on Seedance, made for viral vision", entering word by word in quick succession with strong rhythmic text motion and a product freeze-frame — reference @video6 — the four cookie flavors lined up neatly with the fruits bouncing in sync for a final brand-forward close, the frame full of a young, energetic, delicious, shareable ad atmosphere.',
    title: "Fresh on Seedance",
    videoUrl: `${exploreAdsVideoBaseUrl}/fruity-cookie-commercial.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A reference-guided setup tutorial turns six installation steps into a clear product walkthrough.",
    key: "f607d2a4",
    prompt:
      'A 30-second tutorial video on installing and using a capsule coffee machine. 0-2s: the opening title card reads "seedance capsule coffee machine setup tutorial". 2-5s, Step 1: install the water tank, reference @image1, medium shot from a slightly high angle, rear of the machine body, align the water tank with the slot on the back of the body and push it straight down until it clicks firmly into place, clearly showing how the tank\'s bottom clips align with the body\'s slot, the water level line visible through the tank\'s transparent section, voiceover "First, install the water tank. Align the tank with the slot on the back of the machine; a click means it is locked in place.". 5-9s, Step 2: install the drip tray, reference @image2, close-up front view, front bottom of the body, slide the drip tray horizontally into the guide rails at the bottom until fully seated, voiceover "Next, install the drip tray. Align the tray with the bottom rails.". 9-13s, Step 3: install the used-capsule collection box, reference @image3, close-up from a slightly low angle, the cavity beneath the drip tray, align the collection box with the recess and push it in flush with the drip tray, voiceover "Then insert the capsule collection box. Used capsules will drop down here automatically.". 13-18s, Step 4: first fill with water, reference @image4, close-up side view, the water tank at the top/back of the body, open the tank lid and pour in clean water up to the MAX water level line, then close it, emphasizing the water level line, voiceover "Open the tank lid, pour in clean water, being careful not to exceed the maximum water level line, then close the tank lid.". 18-25s, Step 5: power on, reference @image5, medium shot front view, front of the body, plug in the power cord and press the power button; the indicator light goes from blinking to steady (preheating complete), voiceover "Connect the power and press the power button. The indicator light starts blinking, which means it is preheating. When the light turns steady, the machine is ready.". 25-30s, Step 6: first rinse (without a capsule), reference @image6, medium shot moving to a close-up front-side view, without inserting a capsule press the brew button directly so hot water flows out and rinses the lines, emphasizing the "no capsule needed" note, voiceover "The last step, the first rinse. Note that this step does not require a capsule; just press the brew button. Once the rinse is done, your coffee machine is ready to use."',
    title: "First Brew",
    videoUrl: `${exploreAdsVideoBaseUrl}/capsule-coffee-tutorial.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A branded visual journey moves through windows, water, wildlife, and an eye on the beat.",
    key: "12ac9e7b",
    prompt:
      "A cinematic brand concept short. @image1 is the first frame; the picture trembles slightly, the camera pushes in to tree shadows rushing backward outside the window, their retreat accelerating, then abruptly cuts to @image2, speed easing as the camera glides slowly along a stream, birdsong and blossoms. The camera drops underwater — bubble sounds — as orange jellyfish drift gracefully past the lens @image3; the camera pulls back as small fish flit past and swim from the water into the window @image4, a girl looking around, watching them. The camera pulls back, defocuses, then refocuses sharp, switching to the music's rhythm: a Chinese-garden lattice window @image5 with light circling, church stained glass, an airplane porthole, a dome skylight, a bay window, louver blinds, a European dormer, a door peephole, a camera viewfinder, a bird's eye, a human eye close-up. It settles on the human eye; the eye closes, screen black, then suddenly opens — \"seedance\" appearing in the center of the eye on the accent beat.",
    title: "Windows Through Worlds",
    videoUrl: `${exploreAdsVideoBaseUrl}/windows-worlds-brand-concept.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A modular sofa moves from a pristine studio showcase into a warm family evening.",
    key: "34bd8f16",
    prompt:
      "Produce a 30-second vertical home furnishing advertisement. The main product is a light gray-green modular sectional sofa with rounded curved lines, low thick cushions, paired with a beige blanket and brown pillows.\nThe first 15 seconds are a pure white seamless studio product showcase: the sofa is displayed completely, the camera slowly pushes in close, pans horizontally, and moves laterally to show the outline and form, finally pulling back to a full shot and freeze. Lighting is even and soft, background is pure white and clean, no sweeping lights, no flash whites.\nThe last 15 seconds transition into a warm-lit living room at dusk: the hostess, wearing beige knit loungewear, sits on the sofa reading a book, legs on the beige blanket; she gently places a coffee cup, a cat jumps onto the sofa; a child runs in and leans on her shoulder, the hostess looks down and smiles; at night, a floor lamp lights up, the three quietly lean on the sofa, the camera slowly pulls back and freezes, leaving space for the brand logo. The overall style is restrained, gentle, clean, with authentic and natural visuals.",
    title: "Room to Settle",
    videoUrl: `${exploreAdsVideoBaseUrl}/modular-sofa-tv-ad.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A beachside band hard-cuts through eight languages with precise lip-sync and golden-hour energy.",
    key: "56ce1a90",
    prompt:
      'Cinematic hip-hop / rap music video, photoreal quality, high-end tone, seaside setting. Build the frame from @image1: a band performs at a golden sand beach with crashing waves — a lead vocalist gripping a mic on a stand in the wet sand, one guitarist left, one right, a drummer at the back; a vast coastline behind, rolling waves, a warm golden-hour sun shimmering on the water, sea mist in the air. The lead in a red tracksuit raps to camera — lips and jaw precisely synced to every word, head punching to the beat. Bright, punchy, fast, confident rap. HARD CUT on the beat, each switch a double contrast (shot size and type change together). Lyrics (the lead sings "hello" in each language in turn, precisely lip-synced): English "Hello", Chinese "你好", Japanese "こんにちは", Korean "안녕하세요", Portuguese "Olá", Thai "สวัสดี", Spanish "Hola", Arabic "مرحبا". 8 hard-cut shots (low-angle wide establishing; close-up rap to camera; macro guitar-string insert; 3/4 prowling orbit; lateral track at shore; drummer tilt-up; tight push on the lead; heroic full-band push-in), one language per shot. White balance 4000K, teal-and-amber grade, 35mm, shallow depth of field, film grain, sea mist, golden-hour flare. Premium feel, precise lip-sync, no subtitles, no text overlays, hard cuts only, total 20 seconds.',
    title: "Hello, Everywhere",
    videoUrl: `${exploreAdsVideoBaseUrl}/multilingual-hiphop-mv.mp4`,
  },
  {
    ...exploreVhsTapeGenerationDefaults,
    description:
      "A rain-soaked urban chase escalates through creature impacts and ends on a controlled rooftop reveal.",
    key: "78df3b24",
    prompt:
      "A hyper dynamic cinematic action sequence in a dark modern city at night, wet asphalt, rain reflections, light fog.\n\nA young man in his late teens wearing a red cap, dark blue jacket and backpack is driving fast through empty streets, tense and focused.\n\nHandheld camera inside the car, very close to his face, subtle shake, breathing heavy.\n\nA violent impact hits the roof, the camera jerks hard.\n\nA massive flying creature shadow passes over the windshield.\n\nThe camera whips outside into a fast low tracking shot chasing the car at high speed.\n\nAbove, a large winged creature dives aggressively, wings cutting through the air.\n\nFire blasts hit the road behind the vehicle, lighting up the wet street.\n\nThe car suddenly loses control and skids.\n\nThe camera swings with the motion as the young man bursts out of the car.\n\nThe camera follows tightly behind him in a fast handheld run.\n\nHeavy footsteps shake the ground.\n\nA massive brute creature crashes into frame behind him, smashing a car and throwing debris.\n\nThe camera shakes violently, staying low and close to the action.\n\nHe sprints toward a building and slams into the door.\n\nThe camera rushes forward with him into a narrow corridor, lights flickering.\n\nA shadow-like creature briefly appears on the walls and ceiling, distorted and unstable.\n\nThe man crashes through an apartment door.\n\nThe camera becomes more chaotic, tighter movements.\n\nA small fast creature moves rapidly across surfaces, barely visible, extremely aggressive.\n\nThe man runs toward a large window.\n\nA powerful impact from behind shatters the glass.\n\nBrief slow motion: glass fragments flying as he jumps through.\n\nHe lands outside on a rooftop.\n\nEverything becomes suddenly still.\n\nThe camera slowly pushes in.\n\nBehind him, a tall humanoid creature appears, motionless, controlling the environment.\n\nSmall debris lifts subtly into the air.\n\nCut to black.\n\nStyle: ultra realistic, cinematic lighting, handheld camera, aggressive motion, fast transitions, grounded physics, strong contrast, dramatic shadows.",
    title: "Night Run",
    videoUrl: `${exploreAdsVideoBaseUrl}/city-action-brand-sequence.mp4`,
  },
] as const satisfies readonly ExploreVhsTapeDetails[];

export type ExploreVhsTapeKey =
  | (typeof exploreVhsTapes)[number]["key"]
  | (typeof exploreAdsVhsTapes)[number]["key"];

export function getExploreVhsTapes(category?: CreativeCategory) {
  return category === "ads" ? exploreAdsVhsTapes : exploreVhsTapes;
}

const exploreVhsTapesByKey: ReadonlyMap<
  ExploreVhsTapeKey,
  ExploreVhsTapeDetails
> = new Map(
  [...exploreVhsTapes, ...exploreAdsVhsTapes].map((tape) => [tape.key, tape]),
);

export function isExploreVhsTapeKey(value: string): value is ExploreVhsTapeKey {
  return exploreVhsTapesByKey.has(value as ExploreVhsTapeKey);
}

export function getExploreVhsTape(key: ExploreVhsTapeKey) {
  const tape = exploreVhsTapesByKey.get(key);

  if (!tape) {
    throw new Error(`Unknown Explore VHS tape key: ${key}`);
  }

  return tape;
}
