import { Node, mergeAttributes } from '@tiptap/core'

export const PageBreakExtension = Node.create({
    name: 'pageBreak',

    group: 'block',

    atom: true,

    parseHTML() {
        return [
            {
                tag: 'div[data-type="page-break"]',
            },
            {
                // Also parse manual page breaks if pasted from elsewhere
                tag: 'br[style*="page-break"]',
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'page-break',
                class: 'page-break-marker'
            }),
            '— Page Break —'
        ]
    },

    addCommands() {
        return {
            setPageBreak: () => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                })
            },
        }
    },
})
