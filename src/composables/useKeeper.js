import { computed, reactive } from 'vue'
import { createStorage } from '../services/storage'
import { config, seed } from '../data'

// 兼容历史演示数据：
// 1. 旧菜单只有 number（如「牛腩 500g / 番茄 2 个」），没有 items，按分隔符拆成食材明细
// 2. 有的菜单缺少 done / payment 采购状态字段，按食材勾选情况推导，缺省一律视为未采购
const splitItems = (text) => `${text || ''}`.split(/\s*[\/、，,;；]\s*/).map((x) => x.trim()).filter(Boolean)
function normalize(raw) {
  const data = raw || structuredClone(seed)
  data.policies = (data.policies || []).map((menu) => {
    const items = (menu.items?.length ? menu.items : splitItems(menu.number)).map((item) => ({
      name: typeof item === 'string' ? item : item.name,
      done: Boolean(typeof item === 'string' ? false : item.done)
    }))
    const allDone = items.length > 0 && items.every((item) => item.done)
    return { ...menu, items, done: menu.done ?? allDone, payment: menu.payment || (allDone ? '已采购' : items.length ? '采购中' : '未采购') }
  })
  return data
}

const storage = createStorage(config.storageKey, seed)
export function useKeeper() {
  const state = reactive(normalize(storage.read()))
  const persist = () => storage.write(state)
  const add = (collection, item) => { state[collection].unshift({ id: `${collection}-${Date.now()}`, createdAt: new Date().toISOString(), ...item }); persist() }
  const update = (collection, id, patch) => { const item = state[collection].find((entry) => entry.id === id); if (item) Object.assign(item, patch); persist() }
  const remove = (collection, id) => { state[collection] = state[collection].filter((entry) => entry.id !== id); persist() }
  const reset = () => { const fresh = normalize(structuredClone(seed)); Object.keys(state).forEach((key) => delete state[key]); Object.assign(state, fresh); persist() }
  const metrics = computed(() => config.metrics.map((metric) => ({ ...metric, value: metric.value ? metric.value(state) : state[metric.collection]?.length || 0, hint: typeof metric.hint === 'function' ? metric.hint(state) : '' })))
  return { state, add, update, remove, reset, persist, metrics }
}
