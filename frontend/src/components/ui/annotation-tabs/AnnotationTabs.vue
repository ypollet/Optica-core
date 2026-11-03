<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs"
import { DISTANCE_TAB, LANDMARK_TAB, type AnnotationTab } from "./tabs"

// value of the shown tab, also tells the ImageViewer what a right click creates
const tab = defineModel<string>({ required: true })

withDefaults(defineProps<{
  // one slot per tab value (#landmarks, #distances, #profiles...)
  tabs?: AnnotationTab[]
}>(), {
  tabs: () => [LANDMARK_TAB, DISTANCE_TAB],
})

// "Image Processing" -> "I.P."
function initials(label: string) {
  return label.split(/\s+/).filter(Boolean).map((word) => `${word[0].toUpperCase()}.`).join("")
}
</script>

<template>
  <Tabs :model-value="tab" @update:model-value="(value) => tab = String(value)" class="w-full my-4">
    <!-- the selected tab takes the free space, the others shrink to their icon or initials -->
    <TabsList class="flex w-full">
      <TabsTrigger v-for="item in tabs" :key="item.value" :value="item.value" :title="item.label"
        :class="item.value == tab ? 'flex-1' : 'flex-none px-3 border-input hover:bg-background/60'">
        <template v-if="item.value == tab">{{ item.label }}</template>
        <component v-else-if="item.icon" :is="item.icon" />
        <template v-else>{{ initials(item.label) }}</template>
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="item in tabs" :key="item.value" :value="item.value">
      <slot :name="item.value" />
    </TabsContent>
  </Tabs>
</template>
