<script setup lang="ts" generic="D extends MeasuredDistance">
import { round } from "mathjs"
import { PhCircle, PhX } from "@phosphor-icons/vue"
import { adjustFactorFor, toScale, type ScaleUnit } from "../../../lib/utils"
import { Button } from "../button"
import { Input } from "../input"
import { Label } from "../label"
import { Separator } from "../separator"
import { SelectScale } from "../select-scale"
import { defaultMeasure } from "./measure"
import type { MeasuredDistance, Measure } from "./types"

const distances = defineModel<D[]>({ required: true })
const scale = defineModel<ScaleUnit>('scale', { required: true })
// calibration: typing a known length on a distance sets it
const adjustFactor = defineModel<number>('adjustFactor', { required: true })

const props = withDefaults(defineProps<{
  measure?: Measure<D>
  // units of the scale select
  units?: ScaleUnit[]
  // header with the scale select and the reset button, hidden when empty
  title?: string
  rounding?: number
}>(), {
  title: "Measures",
  rounding: 5,
})

const STEP = 0.01

function length(distance: D): number {
  const value = (props.measure ?? defaultMeasure)(distance, scale.value)
  return value == undefined ? 0 : toScale(value, adjustFactor.value, scale.value)
}

function calibrate(payload: string | number, distance: D) {
  const value = (props.measure ?? defaultMeasure)(distance, scale.value)
  const target = Number(payload)
  if (value && target > 0) {
    adjustFactor.value = adjustFactorFor(value, target, scale.value)
  }
}

function changeLabel(payload: string | number, distance: D) {
  distance.label = payload.toString()
}
</script>

<template>
  <div class="w-full">
    <div v-if="title" class="flex flex-row">
      <h2 class="flex items-center px-7 text-lg font-semibold tracking-tight">{{ title }}</h2>
      <div class="w-full h-full flex justify-end space-x-2">
        <SelectScale v-model="scale" :units="units" />
        <Button variant="secondary" @click="adjustFactor = 1">Reset Scale</Button>
      </div>
    </div>
    <div class="flex min-h-48 min-w-full w-fit flex-col border">
      <div v-for="(distance, index) in distances" :key="index" class="flex flex-col min-w-full w-fit h-10">
        <div class="flex flex-row items-center justify-between space-x-3 px-3 w-full h-full">
          <div class="flex flex-row items-center justify-start space-x-3">
            <PhCircle weight="fill" :color="distance.getColorHEX()" />
            <Label v-show="!distance.edit_label" class="flex whitespace-nowrap w-auto"
              @dblclick="distance.edit_label = true">{{ distance.label }}</Label>
            <Input v-show="distance.edit_label" type="text" :model-value="distance.label" class="flex h-auto w-36 px-0"
              @focusout="distance.edit_label = false" @keyup.enter="distance.edit_label = false"
              @update:model-value="changeLabel($event, distance)" />
          </div>
          <div class="flex flex-row items-center justify-end space-x-3">
            <Label v-show="!distance.edit_distance" class="flex whitespace-nowrap w-auto"
              @dblclick="distance.edit_distance = true">
              {{ round(length(distance), rounding) }} {{ scale }}
            </Label>
            <Input v-show="distance.edit_distance" type="number" :min="0" :step="STEP" :model-value="length(distance)"
              class="flex h-auto w-auto px-0" @focusout="distance.edit_distance = false"
              @keyup.enter="distance.edit_distance = false" @update:model-value="calibrate($event, distance)" />
            <Button class="relative w-6 h-6 p-0" variant="destructive" @click="distances.splice(index, 1)">
              <PhX class="relative w-4 h-4 p-0" />
            </Button>
          </div>
        </div>
        <Separator class="w-full" />
      </div>
    </div>
  </div>
</template>
