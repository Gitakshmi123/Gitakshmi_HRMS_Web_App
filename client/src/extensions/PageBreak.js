import { Node } from '@tiptap/core';

export const PageBreak = Node.create({
    name: 'pageBreak',

    group: 'block',

    parseHTML() {
        return [
            {
                tag: 'div[data-type="page-break"]',
            },
        ];
    },

    renderHTML() {
        return [
            'div',
            {
                'data-type': 'page-break',
            },
        ];
    },

    addCommands() {
        return {
            setPageBreak: () => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                });
            },
        };
    },
});

