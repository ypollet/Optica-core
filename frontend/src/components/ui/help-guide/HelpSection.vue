<script setup lang="ts">
// A collapsible section of the HelpGuide (closed by default), its content is a list of <li>
withDefaults(defineProps<{
  title: string
  open?: boolean
}>(), {
  open: false,
})

defineSlots<{
  // the <li> items
  default(): any
}>()
</script>

<template>
  <details class="mt-3 w-full" :open="open">
    <summary class="cursor-pointer font-semibold">{{ title }}</summary>
    <ul class="mt-2 list-disc space-y-2 pl-6 text-muted-foreground">
      <slot />
    </ul>
  </details>
</template>
