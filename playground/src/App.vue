<script setup lang="ts">
</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/about">About</RouterLink>
    <RouterLink to="/contact">Contact</RouterLink>
  </nav>
  <Suspense>
    <RouterView />
  </Suspense>
</template>