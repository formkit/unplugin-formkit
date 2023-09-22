import { createSSRApp } from 'vue'
import App from './App.vue'
import { createRouter } from './router'

// SSR requires a fresh app instance per request, therefore we export a function
// that creates a fresh app instance. If using Vuex, we'd also be creating a
// fresh store here.
export function createApp() {
  const app = createSSRApp(App)
  const router = createRouter()
  app.use(router)
  return { app, router }
}

// const app = createApp(App)

// app.use(
//   createRouter({
//     history: createWebHistory(),
//     routes: [
//       {
//         path: '/',
//         component: () => import('./pages/Home.vue'),
//       },
//       {
//         path: '/page-a',
//         component: () => import('./pages/PageA.vue'),
//       },
//       {
//         path: '/page-b',
//         component: () => import('./pages/PageB.vue'),
//       },
//     ],
//   }),
// )

// app.mount('#app')
