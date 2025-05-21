import { Extension } from '@tiptap/core'
import { Table as TableExtension } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

export const Table = Extension.create({
  name: 'customTable',

  addExtensions() {
    return [
      TableExtension.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse w-full',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-gray-200',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-200 p-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-200 p-2 bg-gray-50 font-semibold',
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertTable: ({ rows = 3, cols = 3, withHeaderRow = true } = {}) => ({ commands }) => {
        return commands.insertTable({ rows, cols, withHeaderRow })
      },
      addColumnBefore: () => ({ commands }) => {
        return commands.addColumnBefore()
      },
      addColumnAfter: () => ({ commands }) => {
        return commands.addColumnAfter()
      },
      deleteColumn: () => ({ commands }) => {
        return commands.deleteColumn()
      },
      addRowBefore: () => ({ commands }) => {
        return commands.addRowBefore()
      },
      addRowAfter: () => ({ commands }) => {
        return commands.addRowAfter()
      },
      deleteRow: () => ({ commands }) => {
        return commands.deleteRow()
      },
      deleteTable: () => ({ commands }) => {
        return commands.deleteTable()
      },
      toggleHeaderColumn: () => ({ commands }) => {
        return commands.toggleHeaderColumn()
      },
      toggleHeaderRow: () => ({ commands }) => {
        return commands.toggleHeaderRow()
      },
      toggleHeaderCell: () => ({ commands }) => {
        return commands.toggleHeaderCell()
      },
      mergeCells: () => ({ commands }) => {
        return commands.mergeCells()
      },
      splitCell: () => ({ commands }) => {
        return commands.splitCell()
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-t': () => this.editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
    }
  },
}) 