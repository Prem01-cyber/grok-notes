import { Node } from '@tiptap/core'

export const PDF = Node.create({
  name: 'pdf',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="pdf"]',
        getAttrs: dom => ({
          src: dom.getAttribute('data-src'),
          title: dom.getAttribute('data-title'),
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', {
      'data-type': 'pdf',
      'data-src': HTMLAttributes.src,
      'data-title': HTMLAttributes.title,
      class: 'pdf-embed',
    }]
  },

  addNodeView() {
    return ({ node }) => {
      const div = document.createElement('div')
      div.setAttribute('data-type', 'pdf')
      div.setAttribute('data-src', node.attrs.src)
      div.setAttribute('data-title', node.attrs.title || 'PDF Document')
      div.className = 'pdf-embed'

      // You can add a placeholder or iframe for PDF preview if needed
      div.innerHTML = `
        <div style="border: 1px solid #ddd; border-radius: 8px; padding: 10px; background-color: #f9f9f9; text-align: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px;">
            <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
            <path d="M16 13h-4"></path>
            <path d="M16 17h-4"></path>
            <path d="M12 9v2"></path>
            <path d="M12 21v-2"></path>
            <path d="M3 4a2 2 0 0 1 2-2h9l5 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>
          </svg>
          <p style="margin: 0; font-size: 14px; color: #666;">PDF: ${node.attrs.title || 'Untitled PDF'}</p>
        </div>
      `

      return {
        dom: div,
      }
    }
  },
})
