import json

with open('cortex-fresh-export.json', encoding='utf-16') as f:
    data = json.load(f)

nodes = data.get('nodes', [])
edges = data.get('edges', [])
print(f'Nodes: {len(nodes)}')
print(f'Edges: {len(edges)}')

kinds = {}
for n in nodes:
    k = n.get('kind', 'Unknown')
    kinds[k] = kinds.get(k, 0) + 1
print('\nBy kind:')
for k, c in sorted(kinds.items(), key=lambda x: -x[1]):
    print(f'  {k}: {c}')

# Importance distribution
imps = [n.get('importance', 0.5) for n in nodes]
print(f'\nImportance range: {min(imps):.2f} - {max(imps):.2f}')
for threshold in [0.9, 0.8, 0.7, 0.6, 0.5]:
    count = sum(1 for i in imps if i >= threshold)
    print(f'  >= {threshold}: {count} nodes')
