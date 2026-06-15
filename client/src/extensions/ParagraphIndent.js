import { Extension } from '@tiptap/core';

export const ParagraphIndent = Extension.create({
    name: 'paragraphIndent',

    addOptions() {
        return {
            types: ['paragraph', 'heading'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    indentLeft: {
                        default: null,
                        parseHTML: element => {
                            const marginLeft = element.style.marginLeft;
                            if (marginLeft) {
                                // Convert px to mm (approximate: 1px ≈ 0.264mm at 96 DPI)
                                const px = parseFloat(marginLeft);
                                return px ? (px / 3.779527559).toFixed(2) : null;
                            }
                            return null;
                        },
                        renderHTML: attributes => {
                            if (!attributes.indentLeft) {
                                return {};
                            }
                            // Convert mm to px (1mm ≈ 3.78px at 96 DPI)
                            const px = (parseFloat(attributes.indentLeft) * 3.779527559).toFixed(2);
                            return {
                                style: `margin-left: ${px}px`,
                            };
                        },
                    },
                    indentRight: {
                        default: null,
                        parseHTML: element => {
                            const marginRight = element.style.marginRight;
                            if (marginRight) {
                                const px = parseFloat(marginRight);
                                return px ? (px / 3.779527559).toFixed(2) : null;
                            }
                            return null;
                        },
                        renderHTML: attributes => {
                            if (!attributes.indentRight) {
                                return {};
                            }
                            const px = (parseFloat(attributes.indentRight) * 3.779527559).toFixed(2);
                            return {
                                style: `margin-right: ${px}px`,
                            };
                        },
                    },
                    indentFirstLine: {
                        default: null,
                        parseHTML: element => {
                            const textIndent = element.style.textIndent;
                            if (textIndent) {
                                const px = parseFloat(textIndent);
                                return px ? (px / 3.779527559).toFixed(2) : null;
                            }
                            return null;
                        },
                        renderHTML: attributes => {
                            if (!attributes.indentFirstLine) {
                                return {};
                            }
                            const px = (parseFloat(attributes.indentFirstLine) * 3.779527559).toFixed(2);
                            return {
                                style: `text-indent: ${px}px`,
                            };
                        },
                    },
                    marginTop: {
                        default: null,
                        parseHTML: element => {
                            const marginTop = element.style.marginTop;
                            if (marginTop) {
                                const px = parseFloat(marginTop);
                                return px ? (px / 3.779527559).toFixed(2) : null;
                            }
                            return null;
                        },
                        renderHTML: attributes => {
                            if (!attributes.marginTop) {
                                return {};
                            }
                            const px = (parseFloat(attributes.marginTop) * 3.779527559).toFixed(2);
                            return {
                                style: `margin-top: ${px}px`,
                            };
                        },
                    },
                    marginBottom: {
                        default: null,
                        parseHTML: element => {
                            const marginBottom = element.style.marginBottom;
                            if (marginBottom) {
                                const px = parseFloat(marginBottom);
                                return px ? (px / 3.779527559).toFixed(2) : null;
                            }
                            return null;
                        },
                        renderHTML: attributes => {
                            if (!attributes.marginBottom) {
                                return {};
                            }
                            const px = (parseFloat(attributes.marginBottom) * 3.779527559).toFixed(2);
                            return {
                                style: `margin-bottom: ${px}px`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setIndentLeft: (mm) => ({ chain, state }) => {
                const { selection } = state;
                const { $from: _$from } = selection;
                
                // Apply to current paragraph or all paragraphs in selection
                return chain()
                    .updateAttributes('paragraph', { indentLeft: mm })
                    .run();
            },
            setIndentRight: (mm) => ({ chain }) => {
                return chain()
                    .updateAttributes('paragraph', { indentRight: mm })
                    .run();
            },
            setIndentFirstLine: (mm) => ({ chain }) => {
                return chain()
                    .updateAttributes('paragraph', { indentFirstLine: mm })
                    .run();
            },
            setMarginTop: (mm) => ({ chain }) => {
                return chain()
                    .updateAttributes('paragraph', { marginTop: mm })
                    .run();
            },
            setMarginBottom: (mm) => ({ chain }) => {
                return chain()
                    .updateAttributes('paragraph', { marginBottom: mm })
                    .run();
            },
        };
    },
});

