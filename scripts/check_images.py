import re, os, json

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Get actual files in repo
files = {}
for f in os.listdir(os.path.join(BASE, 'images/styles_previews')):
    m = re.match(r'^(.+)_([a-f0-9]{8})\.(jpg|png|webp)$', f)
    if m:
        name = m.group(1)
        hash_val = m.group(2)
        ext = m.group(3)
        files[name] = {'hash': hash_val, 'ext': ext, 'filename': f}

print(f'Found {len(files)} hashed image files in style-source/images/styles_previews/')

# Get all yml files and check their image URLs
total_urls = 0
wrong_urls = []
missing_local_images = []

for root, dirs, fnames in os.walk(os.path.join(BASE, 'styles')):
    for fname in fnames:
        if not fname.endswith('.md') or fname.startswith('_'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath) as f:
            content = f.read()
        
        urls = re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', content)
        for url in urls:
            total_urls += 1
            url_name_match = re.search(r'/([^/]+?)\.(jpg|png|webp)$', url)
            if url_name_match:
                url_name = url_name_match.group(1)
                url_ext = url_name_match.group(2)
                
                if url_name in files:
                    expected = files[url_name]
                    expected_url = f'https://malongan.github.io/style-source/images/styles_previews/{expected["filename"]}'
                    if url != expected_url:
                        wrong_urls.append({
                            'style': fname.replace('.md', ''),
                            'yml_url': url,
                            'expected_url': expected_url,
                            'old_url': url,
                            'new_url': expected_url,
                        })
                else:
                    # Image name not found in repo at all
                    wrong_urls.append({
                        'style': fname.replace('.md', ''),
                        'yml_url': url,
                        'expected_url': 'NOT FOUND IN REPO',
                        'old_url': url,
                        'new_url': 'MISSING',
                    })

print(f'\nTotal image URLs in yml files: {total_urls}')
print(f'Wrong/missing URLs: {len(wrong_urls)}')

# Show summary
old_patterns = {}
for w in wrong_urls:
    pattern = w['old_url']
    if pattern in old_patterns:
        old_patterns[pattern]['count'] += 1
    else:
        old_patterns[pattern] = {'count': 1, 'example_style': w['style']}

print(f'\nUnique wrong URL patterns:')
for url, info in sorted(old_patterns.items(), key=lambda x: -x[1]['count']):
    print(f'  [{info["count"]}x] {url[:80]}...')
    print(f'       Example style: {info["example_style"]}')

print(f'\nAll wrong URL details:')
for w in wrong_urls:
    print(f'  {w["style"]}:')
    print(f'    OLD: {w["old_url"]}')
    print(f'    NEW: {w["new_url"]}')
