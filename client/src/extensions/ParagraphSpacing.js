import { Extension } from '@tiptap/core';

export const ParagraphSpacing = Extension.create({
    name: 'paragraphSpacing',

    addOptions() {
        return {
            types: ['paragraph', 'heading'],
            defaultMarginTop: '0',
            defaultMarginBottom: '0.5em',
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    marginTop: {
                        default: null,
                        parseHTML: element => element.style.marginTop || null,
                        renderHTML: attributes => {
                            if (!attributes.marginTop) {
                                return {};
                            }
                            return {
                                style: `margin-top: ${attributes.marginTop}`,
                            };
                        },
                    },
                    marginBottom: {
                        default: null,
                        parseHTML: element => element.style.marginBottom || null,
                        renderHTML: attributes => {
                            if (!attributes.marginBottom) {
                                return {};
                            }
                            return {
                                style: `margin-bottom: ${attributes.marginBottom}`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setMarginTop: (size) => ({ chain }) => {
                return chain()
                    .updateAttributes('paragraph', { marginTop: size })
                    .updateAttributes('heading', { marginTop: size }) // Also apply to headings if selected
                    .run();
            },
            setMarginBottom: (size) => ({ chain }) => {
                return chain()
                    .updateAttributes('paragraph', { marginBottom: size })
                    .updateAttributes('heading', { marginBottom: size })
                    .run();
            },
        };
    },
});
