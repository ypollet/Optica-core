<script setup lang="ts" generic="T">
import { useQuery } from "@tanstack/vue-query"
import { PhSpinnerGap } from "@phosphor-icons/vue"

// Spinner / error / content around the loading of a project (the old CameraViewer wrappers)
const props = withDefaults(defineProps<{
  load: () => Promise<T>
  queryKey?: unknown[]
}>(), {
  queryKey: () => ["all_images"],
})

defineSlots<{
  default(props: { data: T }): any
}>()

const { isPending, isError, data, error } = useQuery({
  queryKey: props.queryKey,
  queryFn: () => props.load(),
  // load() replaces the project of the store (shown image back to the first one):
  // the images do not change during a session, never load them again on their own
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
})
</script>

<template>
  <div class="w-full h-full border flex justify-center items-center">
    <div v-if="isPending" class="w-full h-full flex justify-center items-center">
      <PhSpinnerGap class="animate-spin" width="10%" height="10%" />
    </div>
    <div v-else-if="isError" class="w-full h-full flex justify-center items-center">
      <div class="text-red-600">{{ error }}</div>
    </div>
    <div v-else-if="data !== undefined" class="w-full h-full flex flex-col items-center">
      <slot :data="data" />
    </div>
  </div>
</template>
