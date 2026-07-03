import json
data = json.load(open('data/styles.json', encoding='utf-8'))
print(f"Total styles in data/styles.json: {len(data['styles'])}")
for s in data['styles']:
    if 'y3k_beverage' in s['id'] or 'maximalist_campus' in s['id'] or '3d_cartoon_girls' in s['id']:
        print(f"FOUND: {s['id']}: {s['name']} [{s['category']}]")
