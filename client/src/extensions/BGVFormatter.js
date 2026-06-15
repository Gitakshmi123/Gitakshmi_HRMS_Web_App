/**
 * BGV Formatter Extension
 * Auto-formats BGV document list when user types or pastes the trigger text
 * 
 * Behavior:
 * - Detects when user types/pastes "5. You are requested to submit copies of the below mentioned documents"
 * - Automatically formats following lines (a-e) with proper indentation
 * - Uses paragraphs with margin-left, NOT list nodes
 * - Prevents duplicate formatting
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { InputRule } from '@tiptap/core';

const BGVFormatter = Extension.create({
    name: 'bgvFormatter',


    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('bgvFormatter'),
                appendTransaction: (transactions, oldState, newState) => {
                    // Only process if document actually changed
                    if (!transactions.some(tr => tr.docChanged)) {
                        return null;
                    }

                    const { doc } = newState;
                    let modified = false;
                    const tr = newState.tr;

                    // Check each paragraph for BGV trigger text
                    doc.descendants((node, pos) => {
                        if (node.type.name === 'paragraph') {
                            const text = node.textContent.trim();
                            
                            // Check if this paragraph contains the BGV trigger (exact or partial match)
                            const isBGVTrigger = text.includes('5. You are requested to submit copies of the below mentioned documents') ||
                                                text.startsWith('5. You are requested to submit copies');
                            
                            if (isBGVTrigger) {
                                // Check if already formatted (has indented items after it)
                                let nextPos = pos + node.nodeSize;
                                const nextNode = doc.nodeAt(nextPos);
                                const hasFormattedItems = nextNode && 
                                    nextNode.type.name === 'paragraph' && 
                                    (nextNode.attrs.indentLeft > 0 || nextNode.attrs.style?.includes('margin-left'));

                                // Only format if not already formatted
                                if (!hasFormattedItems) {
                                    // Look ahead for items a-e that need formatting
                                    let currentPos = nextPos;
                                    const itemsToFormat = [];
                                    
                                    // Look ahead for items a-e (up to 5 items)
                                    for (let i = 0; i < 5 && currentPos < doc.content.size; i++) {
                                        const itemNode = doc.nodeAt(currentPos);
                                        if (!itemNode || itemNode.type.name !== 'paragraph') break;
                                        
                                        const itemText = itemNode.textContent.trim();
                                        const match = itemText.match(/^([a-e])\.\s*(.+)$/);
                                        
                                        if (match) {
                                            // Check if already has indentation
                                            const hasIndent = itemNode.attrs.indentLeft > 0 || 
                                                           (itemNode.attrs.style && itemNode.attrs.style.includes('margin-left'));
                                            
                                            if (!hasIndent) {
                                                itemsToFormat.push({
                                                    pos: currentPos,
                                                    node: itemNode,
                                                });
                                            }
                                            
                                            currentPos += itemNode.nodeSize;
                                            
                                            // Stop after 'e'
                                            if (match[1] === 'e') break;
                                        } else {
                                            break;
                                        }
                                    }
                                    
                                    // If we found items to format, apply indentation using inline style
                                    if (itemsToFormat.length > 0) {
                                        itemsToFormat.forEach(({ pos, node }) => {
                                            // Apply indentation using inline style (works in editor, preview, and PDF)
                                            const attrs = { ...node.attrs };
                                            const currentStyle = attrs.style || '';
                                            
                                            // Add margin-left if not already present
                                            if (!currentStyle.includes('margin-left')) {
                                                attrs.style = currentStyle 
                                                    ? `${currentStyle}; margin-left: 12.7mm;`
                                                    : 'margin-left: 12.7mm;';
                                                
                                                tr.setNodeMarkup(pos, null, attrs);
                                                modified = true;
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    });

                    return modified ? tr : null;
                },
            }),
        ];
    },
});

export default BGVFormatter;

