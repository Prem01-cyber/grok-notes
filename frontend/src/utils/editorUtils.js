// Utility functions for TipTap editor node conversion and manipulation

// Create a TipTap text node from a string, preserving exact text
export const createTextNode = (text) => {
  const safeText = text != null ? String(text) : "";
  return { type: "text", text: safeText };
};

// Create a TipTap paragraph node with given content
export const createParagraphNode = (content) => {
  const children = flattenContent(content);
  return {
    type: "paragraph",
    content: children && children.length > 0 ? children : [],
  };
};

// Create a TipTap list item node with given content
export const createListItemNode = (content) => {
  const children = flattenContent(content);
  const listItemContent = [];
  if (!children || children.length === 0) {
    // Empty list item: include an empty paragraph to preserve the list item structure
    listItemContent.push({ type: "paragraph", content: [] });
  } else if (children.length === 1 && children[0].type === "paragraph") {
    // Single paragraph child, use it directly
    listItemContent.push(children[0]);
  } else {
    // Multiple or mixed children: wrap inline nodes into paragraphs as needed
    let inlineBuffer = [];
    children.forEach((node) => {
      if (!node || !node.type) return;
      const isInlineNode = node.type === "text" || node.type === "hardBreak";
      if (isInlineNode) {
        // Buffer consecutive inline nodes
        inlineBuffer.push(node);
      } else {
        // If a block node appears, flush the current inline buffer into a paragraph
        if (inlineBuffer.length > 0) {
          listItemContent.push({
            type: "paragraph",
            content: [...inlineBuffer],
          });
          inlineBuffer = [];
        }
        // Directly append block-level nodes or nested lists
        if (node.type === "bulletList" || node.type === "orderedList") {
          listItemContent.push(node);
        } else if (node.type === "paragraph") {
          listItemContent.push(node);
        } else {
          // Append any other block node (codeBlock, heading, etc.) as-is
          listItemContent.push(node);
        }
      }
    });
    // Flush any remaining inline nodes as a final paragraph
    if (inlineBuffer.length > 0) {
      listItemContent.push({ type: "paragraph", content: [...inlineBuffer] });
      inlineBuffer = [];
    }
  }
  return { type: "listItem", content: listItemContent };
};

// Flatten content recursively into a flat array of TipTap JSON nodes
export const flattenContent = (content) => {
  // Defensive: if content is null or undefined, return an empty array
  if (content == null) {
    return [];
  }
  // If content is an array, flatten each element recursively
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
  // If content is a string or number, create a text node
  if (typeof content === "string" || typeof content === "number") {
    return [createTextNode(String(content))];
  }
  // If content is already a TipTap node, flatten its content
  if (
    content.type &&
    (content.text !== undefined || content.content !== undefined)
  ) {
    if (content.content) {
      content.content = flattenContent(content.content);
    }
    return [content];
  }
  // If content is an object that's not a TipTap node, convert it
  const converted = convertNodeToJSON(content);
  return flattenContent(converted);
};

// Convert an HTML/Markdown node or structure into TipTap JSON format
export const convertNodeToJSON = (node) => {
  try {
    if (!node) {
      return null;
    }
    // If node is an array of nodes, convert each element
    if (Array.isArray(node)) {
      return flattenContent(node.map((n) => convertNodeToJSON(n)));
    }
    // If node is a string, determine if it's HTML or Markdown
    if (typeof node === "string") {
      const str = node;
      const htmlRegex = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>/;
      if (htmlRegex.test(str)) {
        // Treat as HTML string
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, "text/html");
        const bodyNodes = Array.from(doc.body.childNodes);
        return flattenContent(
          bodyNodes.map((child) => convertNodeToJSON(child))
        );
      } else {
        // Treat as Markdown string
        let ast;
        try {
          ast = unified().use(remarkParse).parse(str);
        } catch (err) {
          console.error("Markdown parse failed:", err);
          // Fallback: wrap raw text in a paragraph
          return createParagraphNode(str);
        }
        return flattenContent(
          ast.children.map((child) => convertNodeToJSON(child))
        );
      }
    }
    // If this is already a TipTap JSON node, return it
    if (
      typeof node.type === "string" &&
      (node.text !== undefined || node.content !== undefined)
    ) {
      if (node.content) {
        node.content = flattenContent(node.content);
      }
      return node;
    }
    // Handle Markdown AST nodes by node.type
    if (node.type) {
      switch (node.type) {
        case "root": {
          if (Array.isArray(node.children)) {
            return flattenContent(
              node.children.map((child) => convertNodeToJSON(child))
            );
          }
          return [];
        }
        case "paragraph": {
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          return createParagraphNode(contentNodes);
        }
        case "text": {
          const textValue =
            node.value !== undefined
              ? node.value
              : node.text !== undefined
              ? node.text
              : "";
          return createTextNode(textValue);
        }
        case "heading": {
          const level = node.depth || node.level || 1;
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          return {
            type: "heading",
            attrs: { level: Math.max(1, Math.min(6, level)) },
            content: flattenContent(contentNodes),
          };
        }
        case "list": {
          const ordered = !!node.ordered;
          const start = typeof node.start === "number" ? node.start : null;
          const listType = ordered ? "orderedList" : "bulletList";
          const listContent = [];
          if (Array.isArray(node.children)) {
            node.children.forEach((item) => {
              const listItemNode = convertNodeToJSON(item);
              if (listItemNode) {
                if (listItemNode.type !== "listItem") {
                  listContent.push(createListItemNode(listItemNode));
                } else {
                  listContent.push(listItemNode);
                }
              }
            });
          }
          const listNode = { type: listType, content: listContent };
          if (ordered && start && start !== 1) {
            listNode.attrs = { start };
          }
          return listNode;
        }
        case "listItem": {
          const itemChildren = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          return createListItemNode(itemChildren);
        }
        case "blockquote": {
          const quoteContent = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          return {
            type: "blockquote",
            content: flattenContent(quoteContent),
          };
        }
        case "code": {
          const codeText = node.value || "";
          const language = node.lang || "";
          return {
            type: "codeBlock",
            attrs: { language },
            content: [createTextNode(codeText)],
          };
        }
        case "inlineCode": {
          const codeText = node.value || "";
          const textNode = createTextNode(codeText);
          textNode.marks = [{ type: "code" }];
          return textNode;
        }
        case "emphasis": {
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          const flattened = flattenContent(contentNodes);
          flattened.forEach((child) => {
            if (child.type === "text") {
              child.marks = [...(child.marks || []), { type: "italic" }];
            }
          });
          return flattened;
        }
        case "strong": {
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          const flattened = flattenContent(contentNodes);
          flattened.forEach((child) => {
            if (child.type === "text") {
              child.marks = [...(child.marks || []), { type: "bold" }];
            }
          });
          return flattened;
        }
        case "delete": {
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          const flattened = flattenContent(contentNodes);
          flattened.forEach((child) => {
            if (child.type === "text") {
              child.marks = [...(child.marks || []), { type: "strike" }];
            }
          });
          return flattened;
        }
        case "link": {
          const contentNodes = node.children
            ? node.children.map((child) => convertNodeToJSON(child))
            : [];
          const flattened = flattenContent(contentNodes);
          const href = node.url || node.href || "";
          flattened.forEach((child) => {
            if (child.type === "text") {
              child.marks = [
                ...(child.marks || []),
                { type: "link", attrs: { href } },
              ];
            }
          });
          return flattened;
        }
        case "image": {
          const src = node.url || "";
          const alt = node.alt || "";
          const title = node.title || "";
          return { type: "image", attrs: { src, alt, title } };
        }
        case "thematicBreak": {
          return { type: "horizontalRule" };
        }
        case "break": {
          return { type: "hardBreak" };
        }
        default: {
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
    }
    // Handle DOM Nodes
    if (node.nodeType) {
      switch (node.nodeType) {
        case Node.TEXT_NODE: {
          const textContent = node.nodeValue || "";
          return createTextNode(textContent);
        }
        case Node.ELEMENT_NODE: {
          const tag = node.tagName ? node.tagName.toLowerCase() : "";
          switch (tag) {
            case "p": {
              const childNodes = Array.from(node.childNodes || []);
              return createParagraphNode(
                childNodes.map((child) => convertNodeToJSON(child))
              );
            }
            case "br": {
              return { type: "hardBreak" };
            }
            case "blockquote": {
              const childNodes = Array.from(node.childNodes || []);
              return {
                type: "blockquote",
                content: flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                ),
              };
            }
            case "ul": {
              const items = Array.from(node.children || [])
                .map((child) => convertNodeToJSON(child))
                .filter((n) => n);
              return { type: "bulletList", content: flattenContent(items) };
            }
            case "ol": {
              const items = Array.from(node.children || [])
                .map((child) => convertNodeToJSON(child))
                .filter((n) => n);
              const listNode = {
                type: "orderedList",
                content: flattenContent(items),
              };
              const startAttr = node.getAttribute
                ? node.getAttribute("start")
                : null;
              if (startAttr) {
                const start = parseInt(startAttr, 10);
                if (!isNaN(start) && start !== 1) {
                  listNode.attrs = { start };
                }
              }
              return listNode;
            }
            case "li": {
              const childNodes = Array.from(node.childNodes || []);
              return createListItemNode(
                childNodes.map((child) => convertNodeToJSON(child))
              );
            }
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6": {
              const level = parseInt(tag.charAt(1), 10) || 1;
              const childNodes = Array.from(node.childNodes || []);
              return {
                type: "heading",
                attrs: { level },
                content: flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                ),
              };
            }
            case "pre": {
              let codeChild = null;
              for (let i = 0; i < node.childNodes.length; i++) {
                const cn = node.childNodes[i];
                if (
                  cn.nodeType === Node.ELEMENT_NODE &&
                  cn.tagName.toLowerCase() === "code"
                ) {
                  codeChild = cn;
                  break;
                }
              }
              if (codeChild) {
                const codeText = codeChild.textContent || "";
                let language = "";
                if (codeChild.getAttribute) {
                  const classAttr = codeChild.getAttribute("class") || "";
                  const match = classAttr.match(/language-([^\s]+)/);
                  if (match) {
                    language = match[1];
                  }
                }
                return {
                  type: "codeBlock",
                  attrs: { language },
                  content: [createTextNode(codeText)],
                };
              } else {
                const preText = node.textContent || "";
                return {
                  type: "codeBlock",
                  attrs: { language: "" },
                  content: [createTextNode(preText)],
                };
              }
            }
            case "code": {
              const codeText = node.textContent || "";
              const textNode = createTextNode(codeText);
              textNode.marks = [{ type: "code" }];
              return textNode;
            }
            case "strong":
            case "b": {
              const childNodes = Array.from(node.childNodes || []);
              const flattened = flattenContent(
                childNodes.map((child) => convertNodeToJSON(child))
              );
              flattened.forEach((child) => {
                if (child.type === "text") {
                  child.marks = [...(child.marks || []), { type: "bold" }];
                }
              });
              return flattened;
            }
            case "em":
            case "i": {
              const childNodes = Array.from(node.childNodes || []);
              const flattened = flattenContent(
                childNodes.map((child) => convertNodeToJSON(child))
              );
              flattened.forEach((child) => {
                if (child.type === "text") {
                  child.marks = [...(child.marks || []), { type: "italic" }];
                }
              });
              return flattened;
            }
            case "u": {
              const childNodes = Array.from(node.childNodes || []);
              const flattened = flattenContent(
                childNodes.map((child) => convertNodeToJSON(child))
              );
              flattened.forEach((child) => {
                if (child.type === "text") {
                  child.marks = [
                    ...(child.marks || []),
                    { type: "underline" },
                  ];
                }
              });
              return flattened;
            }
            case "s":
            case "del": {
              const childNodes = Array.from(node.childNodes || []);
              const flattened = flattenContent(
                childNodes.map((child) => convertNodeToJSON(child))
              );
              flattened.forEach((child) => {
                if (child.type === "text") {
                  child.marks = [...(child.marks || []), { type: "strike" }];
                }
              });
              return flattened;
            }
            case "a": {
              const childNodes = Array.from(node.childNodes || []);
              const flattened = flattenContent(
                childNodes.map((child) => convertNodeToJSON(child))
              );
              const href = node.getAttribute
                ? node.getAttribute("href") || ""
                : "";
              flattened.forEach((child) => {
                if (child.type === "text") {
                  child.marks = [
                    ...(child.marks || []),
                    { type: "link", attrs: { href } },
                  ];
                }
              });
              return flattened;
            }
            case "img": {
              const src = node.getAttribute
                ? node.getAttribute("src") || ""
                : "";
              const alt = node.getAttribute
                ? node.getAttribute("alt") || ""
                : "";
              const title = node.getAttribute
                ? node.getAttribute("title") || ""
                : "";
              return { type: "image", attrs: { src, alt, title } };
            }
            case "hr": {
              return { type: "horizontalRule" };
            }
            default: {
              const childNodes = Array.from(node.childNodes || []);
              return flattenContent(
                childNodes.map((child) => convertNodeToJSON(child))
              );
            }
          }
        }
        case Node.DOCUMENT_FRAGMENT_NODE:
        case Node.DOCUMENT_NODE: {
          const childNodes = Array.from(node.childNodes || []);
          return flattenContent(
            childNodes.map((child) => convertNodeToJSON(child))
          );
        }
        default:
          return null;
      }
    }
    // If node is an object with a toString method, use that as last resort
    if (typeof node.toString === "function") {
      return createTextNode(node.toString());
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
}; 