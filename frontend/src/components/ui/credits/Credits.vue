<script setup lang="ts">
import { Card, CardContent } from '../card'
import { Separator } from '../separator'

import { useDark } from '@vueuse/core'
import type { CreditsContent } from './types'

// the content comes from each viewer (src/config/credits.ts), empty sections are hidden
const props = withDefaults(defineProps<CreditsContent>(), {
  developers: () => [],
  projects: () => [],
  institutions: () => [],
})

defineSlots<{
  // shown above the developers (e.g. the viewer's logo and name)
  header?(): any
}>()

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

const isDark = useDark({
  storageKey: 'localStorage'
})
</script>

<template>
  <Card class="flex h-full min-h-full w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto">
    <CardContent class="flex flex-col w-full min-w-0 space-y-6 p-6">
      <section v-if="$slots.header">
        <slot name="header" />
      </section>

      <!-- Developers -->
      <section v-if="props.developers.length > 0">
        <h4 class="text-base font-semibold">Developers</h4>
        <ul class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-5">
          <li v-for="dev in props.developers" :key="dev.name" class="flex flex-col">
            <a v-if="dev.url" :href="dev.url" target="_blank" rel="noopener noreferrer"
              class="font-medium hover:underline">
              {{ dev.name }}
            </a>
            <span v-else class="font-medium">{{ dev.name }}</span>
            <span v-if="dev.role" class="text-sm text-muted-foreground">{{ dev.role }}</span>
          </li>
        </ul>
      </section>

      <!-- Projects & Institutions share the same logo + name layout -->
      <template v-for="(group, index) in [
        { title: 'Funding Projects', items: props.projects },
        { title: 'Institutions', items: props.institutions },
      ].filter((group) => group.items.length > 0)" :key="group.title">
        <Separator v-if="index > 0 || props.developers.length > 0" />
        <section>
          <h4 class="text-base font-semibold">{{ group.title }}</h4>
          <ul class="mt-3 grid grid-cols-2 md:grid-cols-3 gap-4">
            <li v-for="item in group.items" :key="item.name">
              <component :is="item.url ? 'a' : 'div'" :href="item.url"
                :target="item.url ? '_blank' : undefined" :rel="item.url ? 'noopener noreferrer' : undefined"
                class="flex h-full flex-col items-center gap-2 rounded-md border p-4 text-center transition-colors"
                :class="item.url && 'hover:bg-accent'">
                <div class="flex h-20 w-full items-center justify-center">
                  <img v-if="item.logo" :src="item.logo" :alt="`${item.name} logo`"
                    class="max-h-20 max-w-full object-contain"
                    :class="isDark && item.invert && 'invert'" />
                  <div v-else
                    class="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                    {{ initials(item.name) }}
                  </div>
                </div>
                <span class="text-sm font-medium">{{ item.name }}</span>
                <ul v-if="item.projects?.length" class="flex flex-wrap justify-center gap-1">
                  <li v-for="project in item.projects" :key="project"
                    class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {{ project }}
                  </li>
                </ul>
              </component>
            </li>
          </ul>
        </section>
      </template>
    </CardContent>
  </Card>
</template>
