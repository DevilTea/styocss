import { StringResolver } from './StringResolver'
import type {
  DynamicAliasRule,
  StaticAliasRule,
} from './types'

class AliasResolver<Alias extends string> {
  private _abstractResolver = new StringResolver<string[], StaticAliasRule<Alias>, DynamicAliasRule<Alias>>({
    adaptStaticRule: (rule) => ({
      key: rule.key,
      string: rule.alias,
      resolved: [rule.value].flat(1),
    }),
    adaptDynamicRule: (rule) => ({
      key: rule.key,
      stringPattern: rule.pattern,
      predefinedList: rule.predefinedList,
      createResolved: (...args) => [rule.createValue(...args)].flat(1),
    }),
  })

  get staticAliasRuleList () {
    return [...this._abstractResolver.staticRulesMap.values()]
  }

  get dynamicAliasRuleList () {
    return [...this._abstractResolver.dynamicRulesMap.values()]
  }

  addStaticAliasRule (staticAliasRule: StaticAliasRule<Alias>) {
    this._abstractResolver.addStaticRule(staticAliasRule)
  }

  removeStaticAliasRule (key: string) {
    this._abstractResolver.removeStaticRule(key)
  }

  addDynamicAliasRule (dynamicAliasRule: DynamicAliasRule<Alias>) {
    this._abstractResolver.addDynamicRule(dynamicAliasRule)
  }

  removeDynamicAliasRule (key: string) {
    this._abstractResolver.removeDynamicRule(key)
  }

  resolveAlias (alias: string): string[] | undefined {
    const resolved = this._abstractResolver.resolve(alias)
    if (resolved == null)
      return undefined

    const result = resolved.value
    const finalResult: string[] = []
    let hasDeeperResult = false
    result.forEach((maybeAlias) => {
      const deeperResult = this.resolveAlias(maybeAlias)

      if (deeperResult != null) {
        hasDeeperResult = true
        finalResult.push(...deeperResult)
      } else {
        finalResult.push(maybeAlias)
      }
    })

    if (!hasDeeperResult)
      this._abstractResolver.setResolvedResult(alias, finalResult)

    return finalResult
  }
}

export {
  AliasResolver,
}
