<script setup lang="ts" generic="T extends string | number">
import { ref, useTemplateRef, type HTMLAttributes } from "vue"
import { Label } from "../label"
import Input from "./Input.vue"

// Value shown as a label, typed in place after a double click on it (Enter or leaving the field ends it).
// The other attributes (type, min, step...) go to the field
defineOptions({ inheritAttrs: false })

// a number stays a number
const value = defineModel<T>({ required: true })

const props = withDefaults(defineProps<{
  // false: a double click doesn't start typing, it only emits `dblclick` (e.g. to select the item first)
  editable?: boolean
  // of the label
  class?: HTMLAttributes["class"]
  // of the field shown while typing
  inputClass?: HTMLAttributes["class"]
}>(), {
  editable: true,
})

const emit = defineEmits<{
  // double click on the label, editable or not
  dblclick: [event: MouseEvent]
}>()

defineSlots<{
  // content of the label (default: the value)
  default?(): any
}>()

const input = useTemplateRef('input')
// the label is being typed
const editing = ref<boolean>(false)

function edit(event: MouseEvent) {
  event.preventDefault()
  emit('dblclick', event)
  if (!props.editable) {
    return
  }
  editing.value = true
  // focused once shown
  input.value?.focus()
}

function update(typed: string | number) {
  value.value = (typeof value.value == "number" ? Number(typed) : typed.toString()) as T
}
</script>

<template>
  <Label v-show="!editing" :class="props.class" @dblclick.stop="edit">
    <slot>{{ value }}</slot>
  </Label>
  <Input v-show="editing" ref="input" type="text" v-bind="$attrs" :model-value="value" :class="inputClass"
    @dblclick.stop @focusout="editing = false" @keyup.enter="editing = false" @update:model-value="update" />
</template>
