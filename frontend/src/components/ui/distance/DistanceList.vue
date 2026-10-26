<script setup lang="ts" generic="D extends ListDistance">
import { computed } from "vue"
import type { ScaleUnit } from "../../../lib/utils"
import type { AcceptableValue } from "reka-ui"
import { PhCircle } from "@phosphor-icons/vue"
import { Button } from "../button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../select"
import DistanceIteration from "./DistanceIteration.vue"
import type { ListDistance, Measure } from "./types"

const distances = defineModel<D[]>({ required: true })
// index of the selected distance, -1: the next landmark creates a new distance
const selectedIndex = defineModel<number>('selected', { required: true })
const scale = defineModel<ScaleUnit>('scale', { required: true })

withDefaults(defineProps<{
  adjustFactor?: number
  measure?: Measure<D>
  // units of the scale select
  units?: ScaleUnit[]
}>(), {
  adjustFactor: 1,
})

defineSlots<{
  info?(props: { distance: D }): any
  'landmark-info'?(props: { landmark: D["landmarks"][number] }): any
}>()

const selectedDistance = computed(() => distances.value[selectedIndex.value])

const others = computed(() => distances.value
  .map((distance, index) => ({ distance, index }))
  .filter(({ index }) => index != selectedIndex.value))

function select(payload: AcceptableValue) {
  selectedIndex.value = Number(payload)
}

function deleteDistance(index: number) {
  distances.value.splice(index, 1)
  if (index == selectedIndex.value) {
    selectedIndex.value = -1
  } else if (index < selectedIndex.value) {
    selectedIndex.value -= 1
  }
}
</script>

<template>
  <div class="flex grow w-full flex-col space-y-5">
    <div class="flex space-x-2">
      <Select :model-value="selectedIndex.toString()" @update:model-value="select">
        <SelectTrigger class="w-full">
          <!-- Rendered from the model: reka-ui caches each item's text at mount,
               so its own label goes stale when distances are removed or renamed -->
          <SelectValue>
            <span class="content-center">{{ selectedDistance ? selectedDistance.label : 'New..' }}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem class="h-8" value="-1">
              <div class="flex flex-row space-x-2 items-center">
                <PhCircle />
                <span class="content-center">New..</span>
              </div>
            </SelectItem>
            <SelectItem class="h-8" v-for="(distance, index) in distances" :key="index" :value="index.toString()">
              <div class="flex flex-row space-x-2 items-center">
                <PhCircle weight="fill" :color="distance.getColorHEX()" />
                <span class="content-center">{{ distance.label }}</span>
              </div>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button variant="secondary" @click="select(-1)">New..</Button>
    </div>
    <DistanceIteration v-if="selectedDistance" v-model:scale="scale" :distance="selectedDistance"
      :index="selectedIndex" :selected="true" :adjust-factor="adjustFactor" :measure="measure" :units="units"
      @delete="deleteDistance">
      <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
      <template v-if="$slots['landmark-info']" #landmark-info="slotProps"><slot name="landmark-info" v-bind="slotProps" /></template>
    </DistanceIteration>
    <DistanceIteration v-for="{ distance, index } in others" :key="index" v-model:scale="scale" :distance="distance"
      :index="index" :selected="false" :adjust-factor="adjustFactor" :measure="measure" :units="units" @delete="deleteDistance"
      @select="select">
      <template v-if="$slots.info" #info="slotProps"><slot name="info" v-bind="slotProps" /></template>
    </DistanceIteration>
  </div>
</template>
