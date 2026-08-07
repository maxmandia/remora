const creativeCategories = ["film", "ads", "art"] as const;

type CreativeCategory = (typeof creativeCategories)[number];

type CreativeCategoryDetails = {
  description: string;
  eyebrow: string;
  label: string;
  subtitle: string;
  title: string;
  videoUrl: string;
};

const creativeCategoryDetails: Record<
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

function isCreativeCategory(value: string): value is CreativeCategory {
  return creativeCategories.some((category) => category === value);
}

export {
  creativeCategories,
  creativeCategoryDetails,
  isCreativeCategory,
  type CreativeCategory,
};
