
import re

def find_mismatch(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove strings and comments to avoid false positives
    content = re.sub(r'\{`[^`]*`\}', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*', '', content)
    
    stack = []
    # Find all <div> and </div> tags
    # Simplified regex for demo purposes
    tags = re.findall(r'<(div|/div|form|/form)[^>]*>', content)
    
    line_num = 1
    lines = content.split('\n')
    
    # Actually, let's just do it manually with line tracking
    for i, line in enumerate(lines):
        # Match opening and closing tags
        matches = re.finditer(r'<(div|form|/div|/form)[^>]*>', line)
        for match in matches:
            tag = match.group(1)
            if tag.startswith('/'):
                if not stack:
                    print(f"Extra closing tag </{tag[1:]}> at line {i+1}")
                else:
                    last_tag = stack.pop()
                    if last_tag != tag[1:]:
                        print(f"Mismatch: Expected </{last_tag}> but found </{tag[1:]}> at line {i+1}")
            else:
                # Check for self-closing tags
                if not match.group(0).endswith('/>'):
                    stack.append(tag)
    
    if stack:
        print(f"Unclosed tags: {stack}")

find_mismatch("c:/Users/baldaniya nitesh/Desktop/GT_HRMS/GT_HRMS/client/src/pages/PSA/EditCompany.jsx")
