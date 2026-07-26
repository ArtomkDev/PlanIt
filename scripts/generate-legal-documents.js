const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = process.env.PLANIT_LEGAL_SOURCE_DIR
  ? path.resolve(process.env.PLANIT_LEGAL_SOURCE_DIR)
  : path.resolve(PROJECT_ROOT, "..", "planit-website", "src", "content", "legal");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "src", "config", "legalDocuments.generated.js");
const LEGAL_SITE_URL = process.env.PLANIT_LEGAL_SITE_URL || "https://planit-hub.web.app";

const DOCUMENTS = [
  { type: "privacy", file: "privacy.mdx" },
  { type: "terms", file: "terms.mdx" },
  { type: "cookies", file: "cookies.mdx" },
  { type: "delete", file: "delete.mdx" },
];

const HTML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  ndash: "-",
  mdash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return HTML_ENTITIES[entity] || match;
  });
}

function stripTags(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|dd|dt|th|td|h2|h3)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function resolveMetadataExpression(fragment, metadata) {
  return fragment.replace(/\{legalMetadata\.([A-Za-z0-9_]+)\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(metadata, key) ? metadata[key] : ""
  ));
}

function textFromHtml(fragment, metadata) {
  const withMetadata = resolveMetadataExpression(fragment, metadata);
  const withLinks = withMetadata.replace(
    /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, _quote, href, label) => {
      const cleanLabel = decodeEntities(stripTags(resolveMetadataExpression(label, metadata)))
        .replace(/\s+/g, " ")
        .trim();
      const cleanHref = decodeEntities(href).trim();

      if (!cleanHref || cleanHref.startsWith("./") || cleanHref.startsWith("#")) {
        return cleanLabel;
      }

      if (cleanHref.startsWith("mailto:")) {
        const email = cleanHref.slice("mailto:".length).split("?")[0];
        return cleanLabel === email ? cleanLabel : `${cleanLabel} (${email})`;
      }

      return `${cleanLabel} (${cleanHref})`;
    },
  );

  return decodeEntities(stripTags(withLinks))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?%)])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .trim();
}

function extractMetadata(mdx, sourceFile) {
  const match = mdx.match(/export\s+const\s+legalMetadata\s*=\s*({[\s\S]*?});/);

  if (!match) {
    throw new Error(`Missing legalMetadata export in ${sourceFile}`);
  }

  return {
    metadata: JSON.parse(match[1]),
    content: mdx.slice(match.index + match[0].length),
  };
}

function getTagText(fragment, tagName, metadata) {
  const match = fragment.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? textFromHtml(match[1], metadata) : "";
}

function removeFirstTag(fragment, tagName) {
  return fragment.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "i"), "");
}

function getClassName(fragment) {
  const match = fragment.match(/className=(["'])(.*?)\1/i);
  return match ? match[2] : "";
}

function extractTopLevelDivsBeforeSections(content) {
  const firstSectionIndex = content.search(/<section\b/i);
  const preSectionContent = firstSectionIndex === -1 ? content : content.slice(0, firstSectionIndex);
  const divs = [];
  const divRe = /<div\b[^>]*>([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = divRe.exec(preSectionContent)) !== null) {
    divs.push({
      attributes: match[0].slice(0, match[0].indexOf(">") + 1),
      body: match[1],
    });
  }

  return divs;
}

function parseIntroSection(div, metadata, index) {
  const className = getClassName(div.attributes);
  const heading = getTagText(div.body, "strong", metadata);
  const contentWithoutHeading = removeFirstTag(div.body, "strong");
  const blocks = parseBlocks(contentWithoutHeading, metadata);

  if (!heading && blocks.length === 0) {
    return null;
  }

  return {
    title: heading || metadata.summary || `Notice ${index + 1}`,
    kind: className || "intro",
    blocks,
  };
}

function parseBlocks(fragment, metadata) {
  const blocks = [];
  const tokenRe = /<(h3|p|li|dt|dd|tr|strong|a)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  let pendingDefinitionTerm = null;

  while ((match = tokenRe.exec(fragment)) !== null) {
    const [, tagName, innerHtml] = match;

    if (tagName.toLowerCase() === "tr") {
      const cells = [];
      const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;

      while ((cellMatch = cellRe.exec(innerHtml)) !== null) {
        const cellText = textFromHtml(cellMatch[1], metadata);
        if (cellText) {
          cells.push(cellText);
        }
      }

      if (cells.length > 0) {
        blocks.push({ type: "tableRow", cells });
      }
      continue;
    }

    const text = textFromHtml(innerHtml, metadata);

    if (!text) {
      continue;
    }

    switch (tagName.toLowerCase()) {
      case "h3":
      case "strong":
        blocks.push({ type: "subheading", text });
        break;
      case "a":
        blocks.push({ type: "paragraph", text });
        break;
      case "li":
        blocks.push({ type: "bullet", text });
        break;
      case "dt":
        pendingDefinitionTerm = text;
        break;
      case "dd":
        if (pendingDefinitionTerm) {
          blocks.push({
            type: "definition",
            term: pendingDefinitionTerm,
            text,
          });
          pendingDefinitionTerm = null;
        } else {
          blocks.push({ type: "paragraph", text });
        }
        break;
      case "p":
      default:
        blocks.push({ type: "paragraph", text });
        break;
    }
  }

  return blocks;
}

function parseSections(content, metadata) {
  const sections = [];
  const sectionRe = /<section\b[^>]*>([\s\S]*?)<\/section>/gi;
  let match;

  for (const [index, div] of extractTopLevelDivsBeforeSections(content).entries()) {
    const introSection = parseIntroSection(div, metadata, index);
    if (introSection) {
      sections.push(introSection);
    }
  }

  while ((match = sectionRe.exec(content)) !== null) {
    const sectionHtml = match[1];
    const title = getTagText(sectionHtml, "h2", metadata);
    const body = removeFirstTag(sectionHtml, "h2");
    const blocks = parseBlocks(body, metadata);

    if (title || blocks.length > 0) {
      sections.push({
        title: title || `Section ${sections.length + 1}`,
        kind: "section",
        blocks,
      });
    }
  }

  return sections;
}

function browserUrlsFor(slug) {
  return {
    en: `${LEGAL_SITE_URL}/en/wiki/${slug}`,
    uk: `${LEGAL_SITE_URL}/uk/wiki/${slug}`,
  };
}

function parseDocument(documentConfig) {
  const sourceFile = path.join(SOURCE_DIR, documentConfig.file);
  const mdx = fs.readFileSync(sourceFile, "utf8");
  const { metadata, content } = extractMetadata(mdx, sourceFile);

  return {
    ...metadata,
    type: documentConfig.type,
    effectiveDateLine: `${metadata.effectiveDateLabel} ${metadata.effectiveDateDisplay}`,
    browserUrls: browserUrlsFor(metadata.slug),
    sourceFile: path.relative(PROJECT_ROOT, sourceFile).replace(/\\/g, "/"),
    sections: parseSections(content, metadata),
  };
}

function buildGeneratedSource(documents) {
  const types = Object.fromEntries(documents.map((document) => [document.type, document.type]));
  const source = `// This file is generated by scripts/generate-legal-documents.js.
// Source of truth: ../planit-website/src/content/legal/*.mdx
// Do not edit this file manually.

export const LEGAL_DOCUMENT_TYPES = ${JSON.stringify(types, null, 2)};

export const LEGAL_DOCUMENTS = ${JSON.stringify(
    Object.fromEntries(documents.map((document) => [document.type, document])),
    null,
    2,
  )};

export const getLegalDocument = (documentType) => (
  LEGAL_DOCUMENTS[documentType] || LEGAL_DOCUMENTS[LEGAL_DOCUMENT_TYPES.privacy]
);
`;

  return `${source}\n`;
}

function main() {
  const checkOnly = process.argv.includes("--check");

  if (!fs.existsSync(SOURCE_DIR)) {
    if (fs.existsSync(OUTPUT_FILE)) {
      console.warn(`Legal MDX source not found at ${SOURCE_DIR}. Leaving generated app documents unchanged.`);
      return;
    }

    throw new Error(`Legal MDX source not found at ${SOURCE_DIR}`);
  }

  const documents = DOCUMENTS.map(parseDocument);
  const generatedSource = buildGeneratedSource(documents);

  if (checkOnly) {
    const currentSource = fs.existsSync(OUTPUT_FILE) ? fs.readFileSync(OUTPUT_FILE, "utf8") : "";

    if (currentSource !== generatedSource) {
      throw new Error("Generated legal documents are out of date. Run npm run legal:sync.");
    }
    return;
  }

  fs.writeFileSync(OUTPUT_FILE, generatedSource, "utf8");
  console.log(`Generated ${documents.length} legal documents from ${SOURCE_DIR}`);
}

main();
