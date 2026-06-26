import os
import re

def to_camel(match):
    key = match.group(1)
    camel = re.sub(r'-([a-z])', lambda m: m.group(1).upper(), key)
    return f'"{camel}":'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace "kebab-case": inside style={{...}} with camelCase:
    def style_replacer(match):
        style_content = match.group(1)
        fixed_style = re.sub(r'"([a-z]+-[a-z-]+)"\s*:', to_camel, style_content)
        return 'style={{' + fixed_style + '}}'
        
    new_content = re.sub(r'style=\{\{(.*?)\}\}', style_replacer, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed {filepath}')

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
print('Done!')
