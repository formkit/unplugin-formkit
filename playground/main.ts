import { createApp } from 'vue'
import App from './App.vue'
import { createRouter, createWebHistory } from 'vue-router'

const app = createApp(App)

app.use(
  createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        component: () => import('./pages/Home.vue'),
      },
      {
        path: '/page-a',
        component: () => import('./pages/PageA.vue'),
      },
      {
        path: '/page-b',
        component: () => import('./pages/PageB.vue'),
      },
    ],
  }),
)

app.mount('#app')
