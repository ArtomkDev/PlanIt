const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = process.env.PLANIT_LEGAL_SOURCE_DIR
  ? path.resolve(process.env.PLANIT_LEGAL_SOURCE_DIR)
  : path.join(PROJECT_ROOT, "content", "legal");
const OUTPUT_DIR = process.env.PLANIT_LEGAL_LOADING_OUTPUT_DIR
  ? path.resolve(process.env.PLANIT_LEGAL_LOADING_OUTPUT_DIR)
  : path.resolve(PROJECT_ROOT, "..", "planit-website", "public", "content", "legal");

const DOCUMENTS = ["privacy", "terms", "cookies", "delete", "licenses"];
const VOID_TAGS = new Set(["br"]);

function extractDocumentBody(mdx, sourceFile) {
  const match = mdx.match(/export\s+const\s+legalMetadata\s*=\s*({[\s\S]*?});/);

  if (!match) {
    throw new Error(`Missing legalMetadata export in ${sourceFile}`);
  }

  return mdx.slice(match.index + match[0].length);
}

function getRoleClass(tagName) {
  if (tagName === "h2") {
    return "sk-h";
  }

  if (["h3", "strong", "dt", "caption", "th"].includes(tagName)) {
    return "sk-s";
  }

  if (["a", "code"].includes(tagName)) {
    return "sk-i";
  }

  return "sk-t";
}

function getLineCount(textLength, tagName) {
  if (["h2", "h3", "strong", "dt", "caption", "th", "a", "code"].includes(tagName)) {
    return 1;
  }

  if (["li", "dd", "td"].includes(tagName)) {
    return Math.max(1, Math.min(2, Math.ceil(textLength / 74)));
  }

  return Math.max(1, Math.min(4, Math.ceil(textLength / 92)));
}

function getWidthClass(index, lineCount, textLength, tagName) {
  if (tagName === "h2") {
    return textLength > 34 ? "sk-l" : "sk-m";
  }

  if (["h3", "strong", "dt", "caption", "th", "a", "code"].includes(tagName)) {
    return textLength > 26 ? "sk-m" : "sk-x";
  }

  if (lineCount === 1) {
    return textLength > 78 ? "sk-l" : textLength > 42 ? "sk-m" : "sk-x";
  }

  if (index === lineCount - 1) {
    return textLength % 3 === 0 ? "sk-x" : "sk-m";
  }

  return index % 2 === 0 ? "sk-f" : "sk-l";
}

function placeholderForText(text, stack) {
  const normalizedText = text
    .replace(/\{legalMetadata\.[A-Za-z_$][\w$]*\}/g, "metadata")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedText) {
    return text;
  }

  const tagName = stack.at(-1) || "p";
  const lineCount = getLineCount(normalizedText.length, tagName);
  const roleClass = getRoleClass(tagName);
  const lines = [];

  for (let index = 0; index < lineCount; index += 1) {
    const widthClass = getWidthClass(index, lineCount, normalizedText.length, tagName);
    lines.push(`<span className="sk ${roleClass} ${widthClass}"></span>`);
  }

  return lines.join("");
}

function cleanLoadingTag(tag, tagName) {
  if (tag.startsWith("</")) {
    return tag;
  }

  if (VOID_TAGS.has(tagName)) {
    return "<br />";
  }

  const classMatch = tag.match(/\bclassName=(["'])(.*?)\1/i) || tag.match(/\bclass=(["'])(.*?)\1/i);
  const classAttribute = classMatch ? ` className="${classMatch[2]}"` : "";
  const selfClosing = tag.endsWith("/>") ? " /" : "";

  return `<${tagName}${classAttribute}${selfClosing}>`;
}

function generateLoadingMdxBody(mdxBody) {
  const source = mdxBody.replace(/^\s*;?\s*/, "").trim();
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*)?>/g;
  const stack = [];
  let mdx = "";
  let lastIndex = 0;
  let match;

  while ((match = tagPattern.exec(source)) !== null) {
    mdx += placeholderForText(source.slice(lastIndex, match.index), stack);

    const tag = match[0];
    const tagName = match[1].toLowerCase();
    mdx += cleanLoadingTag(tag, tagName);

    if (tag.startsWith("</")) {
      const lastMatchingIndex = stack.lastIndexOf(tagName);

      if (lastMatchingIndex !== -1) {
        stack.splice(lastMatchingIndex);
      }
    } else if (!tag.endsWith("/>") && !VOID_TAGS.has(tagName)) {
      stack.push(tagName);
    }

    lastIndex = tagPattern.lastIndex;
  }

  mdx += placeholderForText(source.slice(lastIndex), stack);

  return `${mdx}\n`;
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Legal MDX source not found at ${SOURCE_DIR}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const slug of DOCUMENTS) {
    const sourceFile = path.join(SOURCE_DIR, `${slug}.mdx`);
    const outputFile = path.join(OUTPUT_DIR, `${slug}.loading.mdx`);
    const content = extractDocumentBody(fs.readFileSync(sourceFile, "utf8"), sourceFile);
    const loadingMdx = generateLoadingMdxBody(content);

    fs.writeFileSync(outputFile, loadingMdx, "utf8");
  }

  console.log(`Generated ${DOCUMENTS.length} legal loading MDX files in ${OUTPUT_DIR}`);
}

main();
