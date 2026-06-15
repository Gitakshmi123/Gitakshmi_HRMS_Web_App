import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Word Paste Handler Extension
 * Handles copy-paste from Microsoft Word while preserving formatting
 * Uses TipTap's transformPastedHTML hook to clean Word HTML
 */
export const WordPasteHandler = Extension.create({
    name: 'wordPasteHandler',

    addProseMirrorPlugins() {
        const extension = this;
        return [
            new Plugin({
                key: new PluginKey('wordPasteHandler'),
                props: {
                    transformPastedHTML: (html) => {
                        // Clean Word HTML before TipTap processes it
                        return extension.options.cleanWordHTML(html);
                    },
                },
            }),
        ];
    },

    addOptions() {
        return {
            cleanWordHTML: (html) => {
                if (!html) return html;

                // Create a temporary DOM element
                const temp = document.createElement('div');
                temp.innerHTML = html;

                // Remove Word-specific elements
                const wordElements = temp.querySelectorAll('o\\:p, w\\:WordDocument, xml, style[type="text/css"]');
                wordElements.forEach(el => el.remove());

        // Clean up Word classes and attributes
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            // Remove Word-specific classes
            if (el.className) {
                el.className = el.className
                    .split(' ')
                    .filter(cls => !cls.startsWith('Mso') && !cls.startsWith('Word'))
                    .join(' ');
            }

            // Preserve important styles
            const style = el.getAttribute('style') || '';
            const cleanedStyle = this.cleanWordStyles(style);
            if (cleanedStyle) {
                el.setAttribute('style', cleanedStyle);
            } else {
                el.removeAttribute('style');
            }

            // Remove Word-specific attributes
            el.removeAttribute('lang');
            el.removeAttribute('xml:lang');
            el.removeAttribute('xmlns:o');
            el.removeAttribute('xmlns:w');
            el.removeAttribute('xmlns:m');
            el.removeAttribute('xmlns:v');
        });

        // Convert font-size to pt format
        const spans = temp.querySelectorAll('span[style*="font-size"], p[style*="font-size"]');
        spans.forEach(el => {
            const style = el.getAttribute('style');
            if (style) {
                const fontSizeMatch = style.match(/font-size:\s*([\d.]+)(pt|px|em)/i);
                if (fontSizeMatch) {
                    let size = parseFloat(fontSizeMatch[1]);
                    const unit = fontSizeMatch[2].toLowerCase();
                    
                    // Convert to pt if needed
                    if (unit === 'px') {
                        size = Math.round(size * 0.75); // 1px ≈ 0.75pt
                    } else if (unit === 'em') {
                        size = Math.round(size * 12); // 1em ≈ 12pt
                    }
                    
                    const newStyle = style.replace(
                        /font-size:\s*[\d.]+(pt|px|em)/i,
                        `font-size: ${size}pt`
                    );
                    el.setAttribute('style', newStyle);
                }
            }
        });

        return temp.innerHTML;
            },
            
            cleanWordStyles: (style) => {
                if (!style) return '';

                // Remove Word-specific properties
                let cleaned = style
                    .replace(/mso-[^;]*;?/gi, '')
                    .replace(/text-underline:[^;]*;?/gi, '')
                    .replace(/text-overline:[^;]*;?/gi, '')
                    .replace(/text-line-through:[^;]*;?/gi, '');

                // Normalize font-family
                cleaned = cleaned.replace(/font-family:\s*['"]?([^'";]+)['"]?/gi, (match, font) => {
                    const fontMap = {
                        'Calibri': 'Calibri',
                        'Arial': 'Arial',
                        'Times New Roman': 'Times New Roman',
                        'Times': 'Times New Roman',
                        'Courier New': 'Courier New',
                    };
                    
                    const normalizedFont = fontMap[font] || font.split(',')[0].trim();
                    return `font-family: ${normalizedFont}`;
                });

                // Ensure font-size is in pt
                cleaned = cleaned.replace(/font-size:\s*([\d.]+)(px|em)/gi, (match, size, unit) => {
                    let pt = parseFloat(size);
                    if (unit === 'px') pt = Math.round(pt * 0.75);
                    else if (unit === 'em') pt = Math.round(pt * 12);
                    return `font-size: ${pt}pt`;
                });

                return cleaned.trim();
            },
        };
    },
});
