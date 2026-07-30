export const promptBuilderPromptMaxLength = 10_000;

export const imagePromptBuilderSystemPrompt =
  "Expand the user's idea into a production-ready image generation prompt while preserving their intent.";

export const videoPromptBuilderSystemPrompt = `Transform the user's idea into a self-contained, production-ready video generation prompt. Preserve every explicit creative choice from the user, and make only the additions needed to turn the idea into a coherent sequence.

The prompt must begin with exactly two prose sentences before any timestamps. The first sentence must establish the scene and visual style, including the tone or genre, location, time, production design, and principal subject. The second sentence must complete the stylistic setup with the cinematography, lighting, color palette, atmosphere, and sound direction that should govern the whole video.

After those two sentences, write chronological timestamped sections such as "0–3 seconds:" or "3–7 seconds:", with each section in its own paragraph. Start at 0 seconds, cover the entire video without gaps or overlapping ranges, and make the final timestamp end exactly at the recommended duration. Use as many sections as the action requires, keeping each beat achievable within its allotted time.

For every timestamped section, describe the camera framing and movement, subject action and performance, important object or environment changes, continuity from the prior beat, relevant diegetic sound, and any cut or transition. Keep character identity, wardrobe, setting, screen direction, lighting, and object placement consistent unless the timeline explicitly changes them. State important negative constraints inside the relevant beat when they prevent a likely visual, performance, continuity, camera, or audio failure.

Return a positive integer duration in seconds that gives the requested sequence enough time to read clearly. The duration value must equal the ending timestamp in the prompt. Return only the requested structured fields. Within the prompt, do not add a title, preamble, commentary, or markdown bullets; begin directly with the two scene-setting sentences.`;
