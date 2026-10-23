import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { createAppRouter } from './router'
import { installSession } from './plugins/session'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const router = createAppRouter()
installSession(router)
app.use(router)

app.mount('#app')
