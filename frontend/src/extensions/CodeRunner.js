import { Extension } from "@tiptap/core";

const CodeRunner = Extension.create({
  name: "codeRunner",

  addOptions() {
    return {
      onRunCode: null, // Callback to be set by the editor for running code
    };
  },

  addCommands() {
    return {
      runCodeBlock: () => ({ editor, state }) => {
        const { selection } = state;
        const { $from } = selection;
        const node = $from.node();

        if (node.type.name === "codeBlock" && this.options.onRunCode) {
          const code = node.textContent;
          const language = node.attrs.language || "python"; // Default to Python if not specified
          if (language === "python") {
            this.options.onRunCode(code, editor, $from.pos);
            return true;
          }
        }
        return false;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Shift-Enter": () => this.editor.commands.runCodeBlock(),
    };
  },
});

export default CodeRunner;
