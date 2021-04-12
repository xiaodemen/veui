/**
 * 用户直接使用 Provider， 接受一个 provide prop 定义 context
 * 采用 Provider(functional) + ProviderImpl 方式实现的原因：
 *  1. 支持给多个子节点传递 context ： <Provider><a/><b/></Provider>
 *  2. functional 组件定义 provide vueOptions 无效
 */

import { uniqueId, each } from 'lodash'

const CommonProviderImpl = {
  name: 'provider', // for better readability in devtools
  uiTypes: ['transparent'],
  props: {
    // eslint-disable-next-line vue/require-prop-types
    provide: {}
  },
  render () {
    return this.$slots.default
  }
}

function createContext (name) {
  let scopedId = uniqueId(name || CommonProviderImpl.name)
  let RealProviderImpl = {
    ...CommonProviderImpl,
    provide () {
      return { [scopedId]: this.bridge }
    },
    data () {
      return {
        bridge: {}
      }
    },
    computed: {
      realProvide () {
        // 因为下面会 each $set, 所以这里 spread 下（避免属性的响应式丢失）
        // 也不用在 watcher 中 deep 了，如果某个很 deep 的属性变化了，这里不用感知
        return {
          ...(this.provide || {})
        }
      }
    },
    watch: {
      realProvide: {
        immediate: true,
        handler (val) {
          if (!this.bridge.parent) {
            this.bridge.parent = this
          }
          each(val, (itemValue, key) => {
            this.$set(this.bridge, key, itemValue)
          })
        }
      }
    }
  }

  if (name) {
    RealProviderImpl.name = name
  }

  let Provider = {
    functional: true,
    // 这里实际上接受一个 value prop，用来传递 context，但是因为直接透传给 ProviderImpl，所以不用声明了
    // props: ['provide'],
    render: (h, context) => wrapChildren(h, context, RealProviderImpl)
  }

  let useContext = injections => {
    return {
      inject: {
        [scopedId]: {
          from: scopedId,
          default: {}
        }
      },
      computed: injections.reduce((res, item) => {
        item = typeof item === 'string' ? { inject: item } : item
        res[item.inject] = function () {
          let ctx = this[scopedId]
          return ctx ? ctx[item.from || item.inject] : item.default
        }
        return res
      }, {})
    }
  }

  return [Provider, useContext]
}

export const [SelectContextProvider, useSelectContext] = createContext(
  'SelectContext'
)

function wrapChildren (h, { data, children }, Provider) {
  return children.map(child => h(Provider, data, [child]))
}
