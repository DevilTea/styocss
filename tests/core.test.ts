import { beforeEach, describe, it, expect, vi } from 'vitest'
import { createStyoInstance, createStyoPreset } from '@styocss/core'

describe('Test StyoInstance', () => {
  interface LocalTestContext {
    styo: ReturnType<ReturnType<typeof createStyoInstance>['done']>
    cssLines: string[]
  }

  beforeEach<LocalTestContext>((ctx) => {
    ctx.styo = createStyoInstance().done()
    ctx.cssLines = ['/* AtomicStyoRule */']
  })

  it<LocalTestContext>('should output correct css', ({ styo, cssLines }) => {
    expect(styo.style({
      color: 'red',
      backgroundColor: 'red',
    })).toEqual(expect.arrayContaining(['a', 'b']))
    cssLines.push(
      '.a{color:red}',
      '.b{background-color:red}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use duplicated atomic styo rule but the property is in kebab-case.
    expect(styo.style({
      'color': 'red',
      'background-color': 'red',
    })).toEqual(expect.arrayContaining(['a', 'b']))
    // It should not output duplicate css.
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use extra config
    expect(styo.style({
      __nestedWith: '@media (min-width: 300px)',
      __selector: '.aaa .{a}',
      __important: false,
      color: 'blue',
      backgroundColor: 'blue',
    })).toEqual(expect.arrayContaining(['c', 'd']))
    cssLines.push(
      '@media (min-width: 300px){.aaa .c{color:blue}}',
      '@media (min-width: 300px){.aaa .d{background-color:blue}}',
    )
  })
})

function createStyoInstanceWithConfig () {
  const preset = createStyoPreset('test')
    .registerNestedWithTemplates(
      '@media (min-width: 1100px)',
      '@media (min-width: 1200px)',
      '@media (min-width: 1300px)',
    )
    .registerNestedWithTemplates([
      '@media (min-width: 1400px)',
      '@media (min-width: 1500px)',
      '@media (min-width: 1600px)',
    ])
    .registerSelectorTemplates(
      '.eee .{a}',
      '.fff .{a}',
    )
    .registerSelectorTemplates([
      '.ggg .{a}',
      '.hhh .{a}',
    ])
    .registerMacroStyoRule('card', [
      {
        padding: '1rem',
        borderRadius: '0.25rem',
        boxShadow: '0 0 0.5rem rgba(0, 0, 0, 0.5)',
      },
    ])
    .registerMacroStyoRule(/mx-\[(.*)\]/, ([, value]) => [{ marginLeft: value, marginRight: value }], 'mx-[value]')
    .registerMacroStyoRule(/my-\[(.*)\]/, ([, value]) => [{ marginTop: value, marginBottom: value }], 'my-[value]')
    .registerMacroStyoRule(/ma-\[(.*)\]/, ([, value]) => [`mx-[${value}]`, `my-[${value}]`], 'ma-[value]')
    .done()

  return createStyoInstance()
    .setPrefix('styo-')
    .setDefaultNestedWith('@media (min-width: 1000px)')
    .setDefaultSelector('.default .{a}')
    .setDefaultImportant(true)
    .usePreset(preset)
    .registerNestedWithTemplates(
      '@media (min-width: 300px)',
      '@media (min-width: 400px)',
      '@media (min-width: 500px)',
    )
    .registerNestedWithTemplates([
      '',
      '@media (min-width: 600px)',
      '@media (min-width: 700px)',
      '@media (min-width: 800px)',
    ])
    .registerSelectorTemplates(
      '.aaa .{a}',
      '.bbb .{a}',
    )
    .registerSelectorTemplates([
      '.ccc .{a}',
      '.ddd .{a}',
    ])
    .registerMacroStyoRule('center', [
      {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      },
    ])
    .registerMacroStyoRule('btn', [
      {
        __apply: ['center'],
        display: 'inline-block',
        padding: '0.5rem 1rem',
        borderRadius: '0.25rem',
      },
    ])
    .registerMacroStyoRule('btn-primary', [
      'btn',
      {
        backgroundColor: 'blue',
        color: 'white',
      },
    ])
    .registerMacroStyoRule(/px-\[(.*)\]/, ([, value]) => [{ paddingLeft: value, paddingRight: value }], 'px-[value]')
    .registerMacroStyoRule(/py-\[(.*)\]/, ([, value]) => [{ paddingTop: value, paddingBottom: value }], 'py-[value]')
    .registerMacroStyoRule(/pa-\[(.*)\]/, ([, value]) => [`px-[${value}]`, `py-[${value}]`], 'pa-[value]')
    .registerMacroStyoRule('@sm', [
      {
        __nestedWith: '@media (min-width: 300px)',
      },
    ])
    .done()
}

describe('Test StyoInstance (with config)', () => {
  interface LocalTestContext {
    styo: ReturnType<typeof createStyoInstanceWithConfig>
    cssLines: string[]
  }

  beforeEach<LocalTestContext>((ctx) => {
    ctx.styo = createStyoInstanceWithConfig()
    ctx.cssLines = ['/* AtomicStyoRule */']
  })

  it<LocalTestContext>('should output correct css', ({ styo, cssLines }) => {
    expect(styo.style({
      color: 'red',
      backgroundColor: 'red',
    })).toEqual(expect.arrayContaining(['styo-a', 'styo-b']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-a{color:red !important}}',
      '@media (min-width: 1000px){.default .styo-b{background-color:red !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use duplicated atomic styo rule but the property is in kebab-case.
    expect(styo.style({
      'color': 'red',
      'background-color': 'red',
    })).toEqual(expect.arrayContaining(['styo-a', 'styo-b']))
    // It should not output duplicate css.
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use different atomic styo rule with override config
    expect(styo.style({
      __nestedWith: '@media (min-width: 300px)',
      __selector: '.aaa .{a}',
      __important: false,
      color: 'blue',
      backgroundColor: 'blue',
    })).toEqual(expect.arrayContaining(['styo-c', 'styo-d']))
    cssLines.push(
      '@media (min-width: 300px){.aaa .styo-c{color:blue}}',
      '@media (min-width: 300px){.aaa .styo-d{background-color:blue}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // If value is undefined, it should not output css.
    expect(styo.style({
      display: undefined,
      alignItems: undefined,
      justifyContent: undefined,
    })).toEqual([])
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // If using undefined macro styo rule, it should not output css.
    expect(styo.style('undefined')).toEqual([])
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // If using no-property styo rule, it should not output css.
    expect(styo.style('@sm')).toEqual([])
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use static macro styo rules
    expect(styo.style('center')).toEqual(expect.arrayContaining(['styo-e', 'styo-f', 'styo-g']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-e{display:flex !important}}',
      '@media (min-width: 1000px){.default .styo-f{justify-content:center !important}}',
      '@media (min-width: 1000px){.default .styo-g{align-items:center !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('btn')).toEqual(expect.arrayContaining(['styo-f', 'styo-g', 'styo-h', 'styo-i', 'styo-j']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-h{display:inline-block !important}}',
      '@media (min-width: 1000px){.default .styo-i{padding:0.5rem 1rem !important}}',
      '@media (min-width: 1000px){.default .styo-j{border-radius:0.25rem !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('btn-primary')).toEqual(expect.arrayContaining(['styo-f', 'styo-g', 'styo-h', 'styo-i', 'styo-j', 'styo-k', 'styo-l']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-k{background-color:blue !important}}',
      '@media (min-width: 1000px){.default .styo-l{color:white !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use dynamic macro styo rules
    expect(styo.style('px-[4px]')).toEqual(expect.arrayContaining(['styo-m', 'styo-n']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-m{padding-left:4px !important}}',
      '@media (min-width: 1000px){.default .styo-n{padding-right:4px !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('py-[4px]')).toEqual(expect.arrayContaining(['styo-o', 'styo-p']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-o{padding-top:4px !important}}',
      '@media (min-width: 1000px){.default .styo-p{padding-bottom:4px !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('pa-[4px]')).toEqual(expect.arrayContaining(['styo-m', 'styo-n', 'styo-o', 'styo-p']))
    // Reuse 'px-[4px]' and 'py-[4px]' styo rules so it should not output duplicate css.
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('pa-[8px]')).toEqual(expect.arrayContaining(['styo-q', 'styo-r', 'styo-s', 'styo-t']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-q{padding-left:8px !important}}',
      '@media (min-width: 1000px){.default .styo-r{padding-right:8px !important}}',
      '@media (min-width: 1000px){.default .styo-s{padding-top:8px !important}}',
      '@media (min-width: 1000px){.default .styo-t{padding-bottom:8px !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Apply 'btn' macro styo rule with '@sm' breakpoint styo rule
    expect(styo.style({
      __apply: ['btn', '@sm'],
      color: 'green',
    })).toEqual(expect.arrayContaining(['styo-u', 'styo-v', 'styo-w', 'styo-x', 'styo-y', 'styo-z']))
    cssLines.push(
      '@media (min-width: 300px){.default .styo-u{display:inline-block !important}}',
      '@media (min-width: 300px){.default .styo-v{justify-content:center !important}}',
      '@media (min-width: 300px){.default .styo-w{align-items:center !important}}',
      '@media (min-width: 300px){.default .styo-x{padding:0.5rem 1rem !important}}',
      '@media (min-width: 300px){.default .styo-y{border-radius:0.25rem !important}}',
      '@media (min-width: 300px){.default .styo-z{color:green !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    // Use 'card' styo rule from preset
    expect(styo.style('card')).toEqual(expect.arrayContaining(['styo-ba', 'styo-j', 'styo-bb']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-ba{padding:1rem !important}}',
      '@media (min-width: 1000px){.default .styo-bb{box-shadow:0 0 0.5rem rgba(0, 0, 0, 0.5) !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('mx-[4px]')).toEqual(expect.arrayContaining(['styo-bc', 'styo-bd']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-bc{margin-left:4px !important}}',
      '@media (min-width: 1000px){.default .styo-bd{margin-right:4px !important}}',
    )
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('my-[4px]')).toEqual(expect.arrayContaining(['styo-be', 'styo-bf']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-be{margin-top:4px !important}}',
      '@media (min-width: 1000px){.default .styo-bf{margin-bottom:4px !important}}',
    )

    // Reuse 'mx-[4px]' and 'my-[4px]' styo rules so no duplicate styo rules and css.
    expect(styo.style('ma-[4px]')).toEqual(expect.arrayContaining(['styo-bc', 'styo-bd', 'styo-be', 'styo-bf']))
    expect(styo.renderCss().trim()).toBe(cssLines.join('\n'))

    expect(styo.style('ma-[8px]')).toEqual(expect.arrayContaining(['styo-bg', 'styo-bh', 'styo-bi', 'styo-bj']))
    cssLines.push(
      '@media (min-width: 1000px){.default .styo-bg{margin-left:8px !important}}',
      '@media (min-width: 1000px){.default .styo-bh{margin-right:8px !important}}',
      '@media (min-width: 1000px){.default .styo-bi{margin-top:8px !important}}',
      '@media (min-width: 1000px){.default .styo-bj{margin-bottom:8px !important}}',
    )
  })

  it<LocalTestContext>('should trigger "onAtomicUtilityRegistered"', ({ styo }) => {
    const onAtomicStyoRuleRegistered = vi.fn()
    styo.onAtomicStyoRuleRegistered(onAtomicStyoRuleRegistered)

    styo.style({
      backgroundColor: 'red',
    })
    expect(onAtomicStyoRuleRegistered).toHaveBeenCalledTimes(1)
    expect(onAtomicStyoRuleRegistered).toHaveBeenCalledWith({
      registeredAtomicStyoRule: {
        name: 'styo-a',
        content: {
          nestedWith: '@media (min-width: 1000px)',
          selector: '.default .{a}',
          important: true,
          property: 'background-color',
          value: 'red',
        },
      },
      css: '@media (min-width: 1000px){.default .styo-a{background-color:red !important}}',
    })

    styo.style({
      backgroundColor: 'red',
    })
    expect(onAtomicStyoRuleRegistered).toHaveBeenCalledTimes(1)
  })

  it<LocalTestContext>('should not trigger "onAtomicUtilityRegistered" when there are no properties', ({ styo }) => {
    const onAtomicStyoRuleRegistered = vi.fn()
    styo.onAtomicStyoRuleRegistered(onAtomicStyoRuleRegistered)

    styo.style({
      __nestedWith: '@media (min-width: 1100px)',
      __selector: '.aaa .{a}',
    })
    expect(onAtomicStyoRuleRegistered).not.toHaveBeenCalled()

    styo.style('@sm')
    expect(onAtomicStyoRuleRegistered).not.toHaveBeenCalled()
  })
})
