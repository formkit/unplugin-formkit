<script lang="ts">
import { FormKit } from '@formkit/vue'
export default {
  setup() {
    return {
      msg: 'Contact page'
    }
  },
  components: {
    FormKit
  }
}
</script>

<template>
  <FormKitLazyProvider>
    <div>
      <h1>Nothing to see here</h1>
      <FormKit type="checkbox" label="Check me out" />
    </div>
  </FormKitLazyProvider>
</template>