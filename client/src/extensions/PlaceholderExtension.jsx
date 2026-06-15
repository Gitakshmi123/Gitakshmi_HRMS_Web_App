import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';

// --- 1. React Component for the Node View ---
const PlaceholderComponent = ({ node, selected }) => {
    return (
        <NodeViewWrapper className="inline-block align-middle mx-1 select-none">
            <span
                className={`
          inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold
          transition-all duration-200 border cursor-default
          ${selected
                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm transform scale-105'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}
        `}
                title="This placeholder will be replaced with real data"
            >
                <span className="opacity-70 mr-1.5 tracking-tighter">{'{{'}</span>
                {node.attrs.label}
                <span className="opacity-70 ml-1.5 tracking-tighter">{'}}'}</span>
            </span>
        </NodeViewWrapper>
    );
};

// --- 2. The Tiptap Extension ---
export const PlaceholderExtension = Node.create({
    name: 'placeholderComponent',

    group: 'inline',

    inline: true,

    atom: true, // <--- CRITICAL: This makes it treated as a single unit (non-editable internals)

    addAttributes() {
        return {
            id: {
                default: null,
            },
            label: {
                default: 'placeholder',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="placeholder"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'placeholder' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(PlaceholderComponent);
    },

    addCommands() {
        return {
            insertPlaceholder: ({ id, label }) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: { id, label },
                });
            },
        };
    },
});
