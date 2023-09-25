<script lang="ts">
import { FormKit } from '@formkit/vue'

export default {
  components: {
    FormKit,
    FormKitLazyProvider
  }
}
</script>

<template>
  <div>
    <h1>Nothing to see here</h1>
    <FormKit type="text" label="Check me out" />
  </div>
</template>