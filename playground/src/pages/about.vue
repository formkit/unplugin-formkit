<script setup lang="ts">
import { FormKit } from '@formkit/vue'
</script>

<template>
  <div>
    <h1>I have some a FormKit 👀</h1>
    <FormKit
      type="text"
      label="Your name"
      help="Enter your name"
    />
  </div>
</template>