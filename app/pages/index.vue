<script lang="ts" setup>
import {onUnmounted, ref} from "vue";
import {useRouter} from "vue-router";
import {cn} from "~/lib/utils";
import {Button} from "~/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "~/components/ui/card";
import {Tabs, TabsList, TabsTrigger} from "~/components/ui/tabs";
import {detectFaceKeypoints} from "~~/utils/align-face.client";

const props = defineProps<{
  class?: string;
}>();

const router = useRouter();
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const streamRef = ref<MediaStream | null>(null);
const isCameraOn = ref(false);
const recognizeResult = ref<string | null>(null);
const livenessConfidence = ref<number | null>(null);
const recognizing = ref(false);
let recognizeTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = ref(false);

function handleTabChange(value: string) {
  if (value === "manager") router.push("/manager");
}

async function startCamera() {
  if (streamRef.value) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {width: 640, height: 480, facingMode: "user"},
    });
    streamRef.value = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
    }
    isCameraOn.value = true;
    recognizeResult.value = null;
    livenessConfidence.value = null;
    startRecognizeLoop();
  } catch (e) {
    console.error(e);
    recognizeResult.value = "无法打开摄像头";
  }
}

function stopCamera() {
  if (recognizeTimer) {
    clearInterval(recognizeTimer);
    recognizeTimer = null;
  }
  isRunning.value = false;
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }
  if (videoRef.value) videoRef.value.srcObject = null;
  isCameraOn.value = false;
  recognizeResult.value = null;
  livenessConfidence.value = null;
}

async function runRecognitionCycle() {
  if (!isRunning.value || !videoRef.value || !canvasRef.value || !streamRef.value) return;

  const video = videoRef.value;
  if (video.readyState < 2) {
    setTimeout(runRecognitionCycle, 0);
    return;
  }

  const canvas = canvasRef.value;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    setTimeout(runRecognitionCycle, 0);
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const img = new Image();
  img.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load error"));
      img.src = dataUrl;
    });
    const keypoints = await detectFaceKeypoints(img);
    const {name, isReal} = await $fetch<{ name: string | null; isReal: number }>("/api/faces/recognize", {
      method: "POST",
      body: {image: dataUrl, keypoints},
    });
    recognizeResult.value = name ?? "未识别";
    livenessConfidence.value = isReal;
  } catch {
    recognizeResult.value = "未检测到人脸";
    livenessConfidence.value = null;
  }

  setTimeout(runRecognitionCycle, 0);
}

function startRecognizeLoop() {
  if (isRunning.value) return;
  isRunning.value = true;
  runRecognitionCycle();
}

onUnmounted(() => {
  stopCamera();
});
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-xl">
          <Tabs class="w-full self-center" default-value="index" model-value="index">
            <div class="flex justify-center">
              <TabsList>
                <TabsTrigger value="index">身份识别</TabsTrigger>
                <TabsTrigger value="manager" @click="handleTabChange('manager')">
                  身份管理
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col items-center gap-4">
        <div
            class="relative rounded-lg overflow-hidden bg-muted w-full max-w-md aspect-video flex items-center justify-center">
          <video
              v-show="isCameraOn"
              ref="videoRef"
              autoplay
              class="w-full h-full object-cover"
              muted
              playsinline
          />
          <canvas ref="canvasRef" class="hidden"/>
          <div
              v-if="!isCameraOn"
              class="text-muted-foreground text-sm"
          >
            点击「开启摄像头」开始识别
          </div>
          <div
              v-if="isCameraOn && recognizeResult"
              class="absolute bottom-2 left-0 right-0 text-center"
          >
            <span
                :class="
                recognizeResult === '未识别' || recognizeResult === '未检测到人脸'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary text-primary-foreground'
              "
                class="inline-block px-3 py-1 rounded-md text-sm font-medium"
            >
              <template v-if="livenessConfidence !== null">
                {{ recognizeResult + "  |  活体置信度：" + (livenessConfidence * 100).toFixed(2) + "%" }}
              </template>
              <template v-else>
                {{ recognizeResult }}
              </template>
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <Button v-if="!isCameraOn" type="button" @click="startCamera">
            开启摄像头
          </Button>
          <Button v-else type="button" variant="outline" @click="stopCamera">
            关闭摄像头
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
