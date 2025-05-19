import { Node } from "@tiptap/core";

export const GrokBlock = Node.create({
  name: "grokBlock",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div.grok-block" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, class: "grok-block" }, 0];
  },
});
