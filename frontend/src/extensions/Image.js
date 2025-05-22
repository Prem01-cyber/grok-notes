import { Node } from "@tiptap/core";

export const Image = Node.create({
  name: "image",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      src: {
        default: "",
      },
      alt: {
        default: "",
      },
      title: {
        default: "",
      },
      width: {
        default: "100%",
      },
      height: {
        default: "auto",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (dom) => ({
          src: dom.getAttribute("src"),
          alt: dom.getAttribute("alt") || "",
          title: dom.getAttribute("title") || "",
          width: dom.style.width || "100%",
          height: dom.style.height || "auto",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", HTMLAttributes];
  },

  addNodeView() {
    return ({ node }) => {
      const div = document.createElement("div");
      div.className = "image-container";
      div.style.position = "relative";
      div.style.display = "inline-block";
      div.style.margin = "10px 0";
      div.style.maxWidth = "100%";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || "";
      img.title = node.attrs.title || "";
      img.style.width = node.attrs.width;
      img.style.height = node.attrs.height;
      img.style.maxWidth = "100%";
      img.style.borderRadius = "4px";
      img.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";

      div.appendChild(img);

      // Add a resize handle (basic implementation)
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "resize-handle";
      resizeHandle.style.position = "absolute";
      resizeHandle.style.bottom = "0";
      resizeHandle.style.right = "0";
      resizeHandle.style.width = "10px";
      resizeHandle.style.height = "10px";
      resizeHandle.style.background = "#ccc";
      resizeHandle.style.cursor = "se-resize";
      resizeHandle.style.borderRadius = "2px";
      resizeHandle.contentEditable = "false";

      div.appendChild(resizeHandle);

      return {
        dom: div,
        ignoreMutation: () => true,
      };
    };
  },
});
