import { Node } from "@tiptap/core";

export const Video = Node.create({
  name: "video",

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
      controls: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video[src]",
        getAttrs: (dom) => ({
          src: dom.getAttribute("src"),
          alt: dom.getAttribute("alt") || "",
          title: dom.getAttribute("title") || "",
          width: dom.style.width || "100%",
          height: dom.style.height || "auto",
          controls: dom.hasAttribute("controls") ? true : false,
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", HTMLAttributes];
  },

  addNodeView() {
    return ({ node }) => {
      const div = document.createElement("div");
      div.className = "video-container";
      div.style.position = "relative";
      div.style.display = "inline-block";
      div.style.margin = "10px 0";
      div.style.maxWidth = "100%";

      const video = document.createElement("video");
      video.src = node.attrs.src;
      video.alt = node.attrs.alt || "";
      video.title = node.attrs.title || "";
      video.style.width = node.attrs.width;
      video.style.height = node.attrs.height;
      video.style.maxWidth = "100%";
      video.style.borderRadius = "4px";
      video.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
      if (node.attrs.controls) {
        video.setAttribute("controls", "");
      }

      div.appendChild(video);

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
