<script setup lang="ts">
import { useTemplateRef } from "vue"
import { Button } from "../button"
import { Card, CardContent } from "../card"

// Content of Help > "How to use ?" (the #help-guide slot of AppMenu), the same in every viewer:
// what the app is, then one level of collapsible sections, in this order:
//   NavigationHelp, "How it works" (app), DrawingHelp, ManagingHelp, MeasuresHelp, tools (app), MenusHelp
defineProps<{
  appName: string
}>()

defineSlots<{
  // what the app is for, a few sentences
  about(): any
  // the sections
  default(): any
}>()

const sections = useTemplateRef<HTMLElement>("sections")

function setAll(open: boolean) {
  sections.value?.querySelectorAll("details").forEach((details) => details.open = open)
}
</script>

<template>
  <Card class="flex h-full min-h-full w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto">
    <CardContent
      class="flex flex-col h-full min-h-full min-w-0 flex-1 space-y-5 items-start justify-start overflow-x-hidden overflow-y-auto p-6">
      <section class="w-full min-w-0">
        <h4 class="text-base font-semibold">What is {{ appName }}?</h4>
        <div class="mt-1 pl-5 space-y-1 text-muted-foreground break-words">
          <slot name="about" />
        </div>
      </section>
      <section class="w-full min-w-0">
        <div class="flex flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="setAll(true)">Expand all</Button>
          <Button variant="outline" size="sm" @click="setAll(false)">Collapse all</Button>
        </div>
        <div ref="sections">
          <slot />
        </div>
      </section>
    </CardContent>
  </Card>
</template>
