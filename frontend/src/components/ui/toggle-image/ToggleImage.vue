<script setup lang="ts">
import { ToggleGroup, ToggleGroupItem } from "../toggle-group"
import type { ToggleImageItem } from "./types"

// value of the shown image (depth: acquisition id, stack: stack or a stacked image)
const selected = defineModel<string>()

defineProps<{
  items: ToggleImageItem[]
}>()

// clicking the active button unselects it: keep the shown image
function select(value: unknown) {
  if (typeof value == "string") {
    selected.value = value
  }
}
</script>

<template>
  <div class="flex justify-center p-4">
    <ToggleGroup type="single" variant="outline" :spacing="5" class="w-auto max-w-full flex-wrap justify-center"
      :model-value="selected" @update:model-value="select">
      <ToggleGroupItem v-for="item in items" :key="item.value" :value="item.value">
        {{ item.label }}
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
</template>
