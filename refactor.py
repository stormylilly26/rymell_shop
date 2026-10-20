import re
import os

print("Starting refactoring...")

with open('admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<style>\s*(.*?)\s*</style>', html, re.DOTALL)
if not m:
    print("No style block found in admin.html!")
    exit(1)

raw_css = m.group(1)

# Remove the <style> block completely
html = html[:m.start(0)] + '<link rel="stylesheet" href="style.css">' + html[m.end(0):]

# Add class to body
html = html.replace('<body>', '<body class="admin-theme">')

# Modify CSS to prevent collisions
# 1. Transform :root to .admin-theme variables
raw_css = raw_css.replace(':root {', '.admin-theme {')

# 2. Remove the global * rule because style.css already has it
raw_css = re.sub(r'\*\s*\{[^}]*\}', '', raw_css)

# 3. Namespace global element selectors and conflicting classes
replacements = {
    'body {': 'body.admin-theme {',
    'input,\n        textarea {': '.admin-theme input,\n.admin-theme textarea {',
    'input:focus,\n        textarea:focus {': '.admin-theme input:focus,\n.admin-theme textarea:focus {',
    'textarea {': '.admin-theme textarea {',
    'h2.group-title {': '.admin-theme h2.group-title {',
    'label {': '.admin-theme label {',
    '.btn {': '.admin-theme .btn {',
    '.btn-primary {': '.admin-theme .btn-primary {',
    '.btn-primary:hover {': '.admin-theme .btn-primary:hover {',
    '.btn:disabled {': '.admin-theme .btn:disabled {'
}

for old, new in replacements.items():
    raw_css = raw_css.replace(old, new)

# Append to style.css
with open('style.css', 'a', encoding='utf-8') as f:
    f.write('\n\n/* ========================================= */\n')
    f.write('/*          ADMIN THEME STYLES               */\n')
    f.write('/* ========================================= */\n')
    f.write(raw_css)

# Save updated admin.html
with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Styles properly moved and namespaced.")

# Removing the dead admin.css file if it exists
if os.path.exists('admin.css'):
    os.remove('admin.css')
    print("Deleted obsolete admin.css")
