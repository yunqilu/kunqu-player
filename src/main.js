import './styles.css'
import { loadModel } from './lib/model'

const root = document.getElementById('app')

// 先取数据，再【动态】加载 App：useClock 在被 import 时就创建 clock 并读 model.meta.span，
// 所以它必须晚于 loadModel()。
try {
  await loadModel()
} catch (err) {
  const box = document.createElement('div')
  box.className = 'load-error'
  box.textContent = err.message
  if (err.detail) {
    const detail = document.createElement('div')
    detail.className = 'load-error-detail'
    detail.lang = 'zh-CN'
    detail.textContent = err.detail
    box.append(detail)
  }
  root.replaceChildren(box)
  throw err
}

const [{ createApp }, { default: App }] = await Promise.all([import('vue'), import('./App.vue')])
createApp(App).mount(root)
