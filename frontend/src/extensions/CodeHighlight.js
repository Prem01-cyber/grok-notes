import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import { common } from "lowlight";

const lowlightInstance = createLowlight(common);

const CodeHighlight = CodeBlockLowlight.configure({
  lowlight: lowlightInstance,
  HTMLAttributes: {
    class: "rounded-md bg-gray-800 p-5 font-mono text-sm text-gray-100",
  },
});

export default CodeHighlight;
