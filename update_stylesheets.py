#!/usr/bin/env python3
"""Update all HTML files to use external stylesheet instead of inline styles."""

import re
from pathlib import Path

html_files = [
    'teams.html',
    'programs.html',
    'faq.html',
    'privacy-policy.html'
]

# Pattern to match the entire inline style block
style_pattern = r'  <!-- Preload critical assets -->.*?  </style>\n'

# Replacement - link to external stylesheet
replacement = """  <!-- Preload critical assets -->
  <link rel="preload" as="image" href="./assets/images/hero-volleyball-action.jpg">
  
  <!-- Shared Stylesheet -->
  <link rel="stylesheet" href="./assets/styles.css">
"""

for html_file in html_files:
    file_path = Path(html_file)
    if not file_path.exists():
        print(f"File not found: {html_file}")
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the style block
    new_content = re.sub(style_pattern, replacement, content, flags=re.DOTALL)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"✓ Updated {html_file}")
    else:
        print(f"✗ No changes made to {html_file}")