import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';

/**
 * FontSize Extension - Microsoft Word Compatible
 * Uses pt (points) instead of px for Word compatibility
 * 1pt = 1/72 inch = 0.3528mm
 */
export const FontSize = Extension.create({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => {
                            const fontSize = element.style.fontSize;
                            if (!fontSize) return null;
                            
                            // Handle pt, px, em, rem, %
                            if (fontSize.includes('pt')) {
                                return fontSize.replace('pt', '').trim();
                            } else if (fontSize.includes('px')) {
                                // Convert px to pt (1px ≈ 0.75pt at 96 DPI)
                                const px = parseFloat(fontSize);
                                return Math.round(px * 0.75).toString();
                            } else if (fontSize.includes('em')) {
                                // Convert em to pt (assuming 1em = 12pt base)
                                const em = parseFloat(fontSize);
                                return Math.round(em * 12).toString();
                            }
                            return null;
                        },
                        renderHTML: attributes => {
                            if (!attributes.fontSize) {
                                return {};
                            }
                            // Always render as pt (Word standard)
                            const pt = parseFloat(attributes.fontSize) || 11;
                            return {
                                style: `font-size: ${pt}pt`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize: (fontSize) => ({ chain }) => {
                // Ensure fontSize is in pt format
                const pt = parseFloat(fontSize) || 11;
                return chain()
                    .setMark('textStyle', { fontSize: pt.toString() })
                    .run();
            },
            unsetFontSize: () => ({ chain }) => {
                return chain()
                    .setMark('textStyle', { fontSize: null })
                    .removeEmptyTextStyle()
                    .run();
            },
        };
    },
});

