<style>
@import '../assets/css/tailwind.css';
</style>
<script lang="ts" setup>
import {GalleryVerticalEnd} from "lucide-vue-next"
</script>
<template>
  <div class="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <a class="flex items-center gap-2 self-center font-medium" href="#">
        <div class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
          <GalleryVerticalEnd class="size-4"/>
        </div>
        Acme Inc.
      </a>
      <NuxtPage/>
    </div>
  </div>
</template>
