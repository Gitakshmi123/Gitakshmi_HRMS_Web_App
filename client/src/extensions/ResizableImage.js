import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ResizableImageNode from '../components/nodes/ResizableImageNode'

export const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: '200px',
                renderHTML: attributes => ({
                    width: attributes.width,
                    style: `width: ${attributes.width}`
                }),
                parseHTML: element => element.style.width || element.getAttribute('width'),
            },

            // MS Word-style Layout Modes
            layout: {
                default: 'inline', // inline, fixed-left, fixed-right, center, in-front, behind
                renderHTML: attributes => {
                    const styles = [];
                    // Handle modes
                    switch (attributes.layout) {
                        case 'fixed-left': // Square Left
                            styles.push('float: left', 'margin-right: 1.5rem', 'margin-bottom: 0.5rem');
                            break;
                        case 'fixed-right': // Square Right
                            styles.push('float: right', 'margin-left: 1.5rem', 'margin-bottom: 0.5rem');
                            break;
                        case 'center': // Center Block
                            styles.push('display: block', 'margin-left: auto', 'margin-right: auto');
                            break;
                        case 'in-front': // In Front of Text
                            // Note: Absolute pos requires the parent container to be relative.
                            styles.push('position: absolute', 'z-index: 10', `top: ${attributes.top || 0}px`, `left: ${attributes.left || 0}px`);
                            break;
                        case 'behind': // Behind Text
                            styles.push('position: absolute', 'z-index: 0', `top: ${attributes.top || 0}px`, `left: ${attributes.left || 0}px`, 'opacity: 0.5');
                            break;
                        default: // Inline
                            styles.push('display: inline-block', 'vertical-align: middle');
                            break;
                    }
                    return {
                        style: styles.join('; '),
                        'data-layout': attributes.layout
                    };
                },
                parseHTML: element => element.getAttribute('data-layout') || 'inline',
            },

            // Coordinates for Absolute Positioning (In-Front / Behind)
            top: {
                default: 0,
                parseHTML: element => parseFloat(element.style.top) || 0,
            },
            left: {
                default: 0,
                parseHTML: element => parseFloat(element.style.left) || 0,
            },
        }
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageNode)
    },
})

export default ResizableImage;
