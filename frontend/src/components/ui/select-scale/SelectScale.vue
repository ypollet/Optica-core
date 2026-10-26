<script setup lang="ts">
import { SCALE_UNITS, type ScaleUnit } from "../../../lib/utils"
import { Label } from "../label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../select"

// unit of the shown measures
const scale = defineModel<ScaleUnit>({ required: true })

withDefaults(defineProps<{
  // units offered (depth: no px, its profiles are physical)
  units?: ScaleUnit[]
}>(), {
  units: () => SCALE_UNITS,
})
</script>

<template>
  <div class="flex row justify-start space-x-1">
    <Label class="flex whitespace-nowrap w-auto items-center">Scale :</Label>
    <Select v-model="scale">
      <SelectTrigger class="w-20">
        <SelectValue placeholder="Pick a scale" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Scale</SelectLabel>
          <SelectItem v-for="unit in units" :key="unit" :value="unit">
            {{ unit }}
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
