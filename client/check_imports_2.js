import * as FontFamilyPkg from '@tiptap/extension-font-family';
import * as TextStylePkg from '@tiptap/extension-text-style';
import * as HighlightPkg from '@tiptap/extension-highlight';
import * as TextAlignPkg from '@tiptap/extension-text-align';
import * as UnderlinePkg from '@tiptap/extension-underline';
import * as LinkPkg from '@tiptap/extension-link';
import * as PlaceholderPkg from '@tiptap/extension-placeholder';

console.log('FontFamily exports:', Object.keys(FontFamilyPkg));
console.log('TextStyle exports:', Object.keys(TextStylePkg));
console.log('Highlight exports:', Object.keys(HighlightPkg));
console.log('TextAlign exports:', Object.keys(TextAlignPkg));
console.log('Underline exports:', Object.keys(UnderlinePkg));
console.log('Link exports:', Object.keys(LinkPkg));
console.log('Placeholder exports:', Object.keys(PlaceholderPkg));
