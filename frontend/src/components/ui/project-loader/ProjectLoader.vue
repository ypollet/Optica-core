<script setup lang="ts" generic="T">
import { ref, shallowRef } from "vue"
import { PhSpinnerGap } from "@phosphor-icons/vue"

// Spinner / error / content around the loading of a project (the old CameraViewer wrappers).
// Loaded once: the apps read the object from the url at startup (?series=) and keep it for the session.
// An app switching objects without reloading the page remounts it (:key="objectPath").
const props = defineProps<{
  load: () => Promise<T>
}>()

defineSlots<{
  default(props: { data: T }): any
}>()

const status = ref<"pending" | "error" | "loaded">("pending")
const data = shallowRef<T>()
const error = ref<unknown>(null)

props.load()
  .then((loaded) => {
    data.value = loaded
    status.value = "loaded"
  })
  .catch((reason) => {
    error.value = reason
    status.value = "error"
  })
</script>

<template>
  <div class="w-full h-full border flex justify-center items-center">
    <div v-if="status == 'pending'" class="w-full h-full flex justify-center items-center">
      <PhSpinnerGap class="animate-spin" width="10%" height="10%" />
    </div>
    <div v-else-if="status == 'error'" class="w-full h-full flex justify-center items-center">
      <div class="text-red-600">{{ error }}</div>
    </div>
    <div v-else-if="data !== undefined" class="w-full h-full flex flex-col items-center">
      <slot :data="data" />
    </div>
  </div>
</template>
