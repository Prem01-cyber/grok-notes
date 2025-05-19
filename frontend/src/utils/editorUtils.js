import { unified } from "unified";
import remarkParse from "remark-parse";

export function decodeChunk(chunk) {
  return chunk
    .replace(/\n/g, "\n")
    .replace(/\t/g, "\t")
    .replace(/\r/g, "\r")
    .replace(/\"/g, '"')
    .replace(/\'/g, "'")
    .replace(/\\/g, "\\");
}

export function extractStructuredContext(json) {
  if (!json || !json.content) return "";

  return json.content
    .map((node) => {
      if (node.type?.startsWith("heading")) {
        const level = node.attrs?.level || 1;
        const text = node.content?.map((n) => n.text).join(" ") || "";
        return `Heading ${level}: ${text}`;
      } else if (node.type === "paragraph") {
        const text = node.content?.map((n) => n.text).join(" ") || "";
        return `- ${text}`;
      }
      return "";
    })
    .join("\n");
}

export function createTextNode(text) {
  const safeText = text != null ? String(text) : "";
  return { type: "text", text: safeText };
}

export function createParagraphNode(content) {
  const children = flattenContent(content);
  return {
    type: "paragraph",
    content: children && children.length > 0 ? children : [],
  };
}

export function createListItemNode(content) {
  const children = flattenContent(content);
  const listItemContent = [];
  if (!children || children.length === 0) {
    listItemContent.push({ type: "paragraph", content: [] });
  } else if (children.length === 1 && children[0].type === "paragraph") {
    listItemContent.push(children[0]);
  } else {
    let inlineBuffer = [];
    children.forEach((node) => {
      if (!node || !node.type) return;
      const isInlineNode = node.type === "text" || node.type === "hardBreak";
      if (isInlineNode) {
        inlineBuffer.push(node);
      } else {
        if (inlineBuffer.length > 0) {
          listItemContent.push({
            type: "paragraph",
            content: [...inlineBuffer],
          });
          inlineBuffer = [];
        }
        if (node.type === "bulletList" || node.type === "orderedList") {
          listItemContent.push(node);
        } else if (node.type === "paragraph") {
          listItemContent.push(node);
        } else {
          listItemContent.push(node);
        }
      }
    });
    if (inlineBuffer.length > 0) {
      listItemContent.push({ type: "paragraph", content: [...inlineBuffer] });
    }
  }
  return { type: "listItem", content: listItemContent };
}

export function flattenContent(content) {
  if (content == null) {
    return [];
  }
  if (Array.isArray(content)) {
    const flat = [];
    content.forEach((item) => {
      const flattenedItem = flattenContent(item);
      if (Array.isArray(flattenedItem)) {
        flat.push(...flattenedItem);
      } else if (flattenedItem != null) {
        flat.push(flattenedItem);
      }
    });
    return flat;
  }
  if (typeof content === "string" || typeof content === "number") {
    return [createTextNode(String(content))];
  }
  if (
    content.type &&
    (content.text !== undefined || content.content !== undefined)
  ) {
    if (content.content) {
      content.content = flattenContent(content.content);
    }
    return [content];
  }
  const converted = convertNodeToJSON(content);
  return flattenContent(converted);
}

export function convertNodeToJSON(node) {
  try {
    if (!node) {
      return null;
    }
    if (Array.isArray(node)) {
      return flattenContent(node.map((n) => convertNodeToJSON(n)));
    }
    if (typeof node === "string") {
      const str = node;
      const htmlRegex = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>/;
      if (htmlRegex.test(str)) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, "text/html");
        const bodyNodes = Array.from(doc.body.childNodes);
        return flattenContent(
          bodyNodes.map((child) => convertNodeToJSON(child))
        );
      } else {
        let ast;
        try {
          ast = unified().use(remarkParse).parse(str);
        } catch (err) {
          console.error("Markdown parse failed:", err);
          return createParagraphNode(str);
        }
        return flattenContent(
          ast.children.map((child) => convertNodeToJSON(child))
        );
      }
    }
    if (
      typeof node.type === "string" &&
      (node.text !== undefined || node.content !== undefined)
    ) {
      if (node.content) {
        node.content = flattenContent(node.content);
      }
      return node;
    }
    // Handle Markdown AST nodes
    if (node.type) {
      switch (node.type) {
        case "root":
          if (Array.isArray(node.children)) {
            return flattenContent(
              node.children.map((child) => convertNodeToJSON(child))
            );
          }
          return [];
        case "paragraph":
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          return createParagraphNode(contentNodes);
        case "text":
          const textValue =
            node.value !== undefined
              ? node.value
              : node.text !== undefined
              ? node.text
              : "";
          return createTextNode(textValue);
        case "heading":
          const level = node.depth || node.level || 1;
          const headingContent = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          return {
            type: "heading",
            attrs: { level: Math.max(1, Math.min(6, level)) },
            content: flattenContent(headingContent),
          };
        // Add other cases as needed
        default:
          if (node.value !== undefined) {
            return createTextNode(node.value);
          } else if (node.children) {
            return flattenContent(
              node.children.map((child) => convertNodeToJSON(child))
            );
          }
          return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error converting node to JSON:", error, node);
    try {
      const text =
        typeof node === "string"
          ? node
          : node && node.toString
          ? node.toString()
          : "";
      return createTextNode(text);
    } catch {
      return null;
    }
  }
} 