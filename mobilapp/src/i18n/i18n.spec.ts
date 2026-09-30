import da from './da.json';
import en from './en.json';

type Tree = { readonly [key: string]: string | Tree };

/** Every leaf as `'a.b.c': value`. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((leaves, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...leaves, [path]: value }
      : { ...leaves, ...flatten(value, path) };
  }, {});
}

function params(text: string): string[] {
  return (text.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((param) => param.replace(/\s/g, '')).sort();
}

describe('en.json', () => {
  const danish = flatten(da);
  const english = flatten(en);

  it('has exactly the keys of da.json', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(danish).sort());
  });

  it('keeps every {{param}} of the Danish text', () => {
    for (const [key, text] of Object.entries(danish)) {
      expect(params(english[key] ?? ''), key).toEqual(params(text));
    }
  });
});
