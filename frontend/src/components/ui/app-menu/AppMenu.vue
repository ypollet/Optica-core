<script setup lang="ts">
import { ref } from "vue"
import { useDark, useToggle } from "@vueuse/core"
import {
  Menubar, MenubarContent, MenubarItem, MenubarLabel, MenubarMenu, MenubarShortcut,
  MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger,
} from "../menubar"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../dialog"
import { Button } from "../button"
import { Credits, type CreditsContent } from "../credits"
import { Input } from "../input"
import { Label } from "../label"
import { Switch } from "../switch"

// "Reverse Mode": sidebar on the left
const reverse = defineModel<boolean>("reverse", { default: false })

const props = withDefaults(defineProps<{
  // name shown in the help dialog
  appName?: string
  importable?: boolean
  exportable?: boolean
  // content of Help > Credits (the viewer's src/config/credits.ts), the item is hidden without it
  credits?: CreditsContent
}>(), {
  appName: "Optica",
  importable: true,
  exportable: true,
})

const emit = defineEmits<{
  // content of the imported landmark file
  import: [content: string]
  export: [format: "csv" | "json"]
}>()

defineSlots<{
  // content of the "How to use ?" dialog, the item is hidden without it
  'help-guide'?(): any
  // extra menus after Settings
  menus?(): any
}>()

const isDark = useDark({ storageKey: "localStorage" })
const toggleDark = useToggle(isDark)

const importOpen = ref<boolean>(false)
const helpOpen = ref<boolean>(false)
const creditsOpen = ref<boolean>(false)

function onSubmit(event: Event) {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const file = (form.elements[0] as HTMLInputElement).files?.[0]
  if (file) {
    file.text().then((text) => emit("import", text)).catch((reason) => console.error(reason))
  }
}
</script>

<template>
  <div>
    <Menubar class="border-none z-100 h-10">
      <MenubarMenu>
        <MenubarTrigger class="relative">File</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Landmarks</MenubarLabel>
          <MenubarItem inset :disabled="!importable" @select="importOpen = true">Import</MenubarItem>
          <MenubarSub>
            <MenubarSubTrigger inset :disabled="!exportable">Export</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem @select="emit('export', 'csv')">CSV</MenubarItem>
              <MenubarItem @select="emit('export', 'json')">JSON</MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem disabled>Undo <MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
          <MenubarItem disabled>Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Settings</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel inset>
            <div class="flex flex-row justify-between h-full w-full"><span>Dark Mode :</span>
              <Switch :model-value="isDark" @update:model-value="toggleDark()" class="inline-block align-middle ml-auto" />
            </div>
          </MenubarLabel>
          <MenubarLabel inset>
            <div class="flex flex-row justify-between h-full w-full"><span>Reverse Mode :</span>
              <Switch v-model="reverse" class="inline-block align-middle self-end" />
            </div>
          </MenubarLabel>
        </MenubarContent>
      </MenubarMenu>
      <slot name="menus" />
      <MenubarMenu v-if="$slots['help-guide'] || credits">
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem v-if="$slots['help-guide']" inset @select="helpOpen = true">How to use ?</MenubarItem>
          <MenubarItem v-if="credits" inset @select="creditsOpen = true">Credits</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>

    <Dialog v-model:open="importOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add the landmark file</DialogTitle>
          <DialogDescription>Add the json files containing the landmarks</DialogDescription>
        </DialogHeader>
        <form @submit="onSubmit">
          <Label>File</Label>
          <Input type="file" accept=".json,application/json" placeholder="your landmark json file" />
          <DialogFooter>
            <DialogClose as-child>
              <Button type="submit">Confirm</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-if="$slots['help-guide']" v-model:open="helpOpen">
      <DialogContent class="flex h-[85vh] w-[50vw] max-w-none flex-col overflow-hidden">
        <DialogHeader class="shrink-0">
          <DialogTitle>App guide</DialogTitle>
          <DialogDescription>Quick instructions for {{ appName }}.</DialogDescription>
        </DialogHeader>
        <div class="min-h-0 h-full w-full flex-1 overflow-y-auto overflow-x-hidden">
          <slot name="help-guide" />
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-if="credits" v-model:open="creditsOpen">
      <DialogContent class="flex h-[85vh] w-[50vw] max-w-none flex-col overflow-hidden">
        <DialogHeader class="shrink-0">
          <DialogTitle>Credits</DialogTitle>
          <DialogDescription>Thank to everyone that contributed to this project</DialogDescription>
        </DialogHeader>
        <div class="min-h-0 h-full w-full flex-1 overflow-y-auto overflow-x-hidden">
          <Credits v-bind="props.credits" />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
