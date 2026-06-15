import * as TextStylePkg from '@tiptap/extension-text-style';
import * as HighlightPkg from '@tiptap/extension-highlight';
import * as TableRowPkg from '@tiptap/extension-table-row';
import * as TableCellPkg from '@tiptap/extension-table-cell';
import * as TableHeaderPkg from '@tiptap/extension-table-header';

console.log('TextStyle has default:', 'default' in TextStylePkg);
console.log('Highlight has default:', 'default' in HighlightPkg);
console.log('TableRow has default:', 'default' in TableRowPkg);
console.log('TableCell has default:', 'default' in TableCellPkg);
console.log('TableHeader has default:', 'default' in TableHeaderPkg);
