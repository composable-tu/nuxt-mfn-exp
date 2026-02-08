<style>
@import '../assets/css/tailwind.css';
</style>
<script lang="ts" setup>
import {ScanFace} from "lucide-vue-next"
</script>
<template>
  <div class="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <a class="flex items-center gap-2 self-center font-medium" href="#">
        <div class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <ScanFace class="size-6"/>
        </div>
        人脸身份识别 Demo
      </a>
      <NuxtPage/>
    </div>
    <p class="px-6 text-center text-muted-foreground text-sm">
      网站仅供演示使用，版权归相关权利人所有
    </p>
  </div>
</template>
