import { HOLIDAY_KEYS } from '@/domain/holidays';
import { DROP_REACTIONS, GOALS, HORIZONS, INCOME_STABILITY } from '@/domain/riskProfile';
import { WEALTH_FIELDS, WEALTH_KINDS } from '@/domain/wealthForms';

import { languageFromLocales, resolveLanguage } from '..';
import en from '../locales/en';
import zhHans from '../locales/zh-Hans';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : leaves(value, `${prefix}${key}.`)
  );
}

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe('locales', () => {
  const enLeaves = new Map(leaves(en));
  const zhLeaves = new Map(leaves(zhHans));

  it('have the same keys', () => {
    expect([...zhLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it('have no empty strings', () => {
    for (const [key, value] of [...enLeaves, ...zhLeaves]) {
      expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
    }
  });

  it('use the same interpolation placeholders', () => {
    for (const [key, value] of enLeaves) {
      expect({ key, vars: placeholders(zhLeaves.get(key) ?? '') }).toEqual({
        key,
        vars: placeholders(value),
      });
    }
  });
});

describe('language detection', () => {
  it('maps any Chinese locale to Simplified Chinese', () => {
    expect(languageFromLocales([{ languageCode: 'zh' }])).toBe('zh-Hans');
  });

  it('takes the first supported language in preference order', () => {
    expect(languageFromLocales([{ languageCode: 'fr' }, { languageCode: 'en' }])).toBe('en');
    expect(languageFromLocales([{ languageCode: 'ja' }])).toBe('en');
  });

  it('lets an explicit preference win over the device', () => {
    expect(resolveLanguage('en', [{ languageCode: 'zh' }])).toBe('en');
    expect(resolveLanguage('system', [{ languageCode: 'zh' }])).toBe('zh-Hans');
  });
});

describe('keys built from data', () => {
  const lookup = (tree: Tree, path: string): unknown =>
    path.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

  const keys: string[] = HOLIDAY_KEYS.map((key) => `holidays.${key}`);
  for (const kind of WEALTH_KINDS) {
    keys.push(`wealth.sections.${kind}`, `wealth.sectionHints.${kind}`, `wealth.add.${kind}`);
    for (const spec of WEALTH_FIELDS[kind]) {
      keys.push(`wealth.fields.${spec.key}`);
      if (spec.hint) keys.push(`wealth.hints.${spec.key}`);
      if (spec.placeholder) keys.push(`wealth.placeholders.${kind}.${spec.key}`);
      for (const option of spec.options ?? []) {
        keys.push(`wealth.options.${spec.optionSet}.${option}`);
      }
    }
  }
  const answers = {
    horizon: HORIZONS,
    goal: GOALS,
    dropReaction: DROP_REACTIONS,
    incomeStability: INCOME_STABILITY,
  };
  for (const [question, values] of Object.entries(answers)) {
    for (const value of values) keys.push(`risk.answers.${question}.${value}`);
  }

  it.each([...new Set(keys)])('%s exists in both languages', (key) => {
    expect(typeof lookup(en, key)).toBe('string');
    expect(typeof lookup(zhHans, key)).toBe('string');
  });
});
