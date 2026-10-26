<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs"

export type AnnotationTab = { value: string, label: string }

// value of the shown tab, also tells the ImageViewer what a right click creates
const tab = defineModel<string>({ required: true })

withDefaults(defineProps<{
  // one slot per tab value (#landmarks, #distances, #profiles...)
  tabs?: AnnotationTab[]
}>(), {
  tabs: () => [{ value: "landmarks", label: "Landmarks" }, { value: "distances", label: "Distances" }],
})
</script>

<template>
  <Tabs :model-value="tab" @update:model-value="(value) => tab = String(value)" class="w-full my-4">
    <TabsList class="grid w-full" :style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }">
      <TabsTrigger v-for="item in tabs" :key="item.value" :value="item.value">
        {{ item.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="item in tabs" :key="item.value" :value="item.value">
      <slot :name="item.value" />
    </TabsContent>
  </Tabs>
</template>
