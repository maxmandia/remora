export function parseModelPageFrontmatter(source: string, sourcePath: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match?.[1]) {
    throw new Error(`Model page ${sourcePath} requires JSON frontmatter`);
  }

  try {
    return JSON.parse(removeTrailingCommas(match[1])) as unknown;
  } catch (error) {
    throw new Error(`Model page ${sourcePath} has invalid JSON frontmatter`, {
      cause: error,
    });
  }
}

function removeTrailingCommas(value: string) {
  let result = "";
  let escaped = false;
  let inString = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === ",") {
      let nextIndex = index + 1;
      while (/\s/.test(value[nextIndex] ?? "")) {
        nextIndex += 1;
      }

      if (value[nextIndex] === "}" || value[nextIndex] === "]") {
        continue;
      }
    }

    result += character;
  }

  return result;
}
