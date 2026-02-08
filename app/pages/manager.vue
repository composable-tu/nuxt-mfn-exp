<script lang="ts" setup>
import {onMounted, ref} from "vue";
import {useRouter} from "vue-router";
import {cn} from "~/lib/utils";
import {Button} from "~/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "~/components/ui/card";
import {Field, FieldGroup, FieldLabel} from "~/components/ui/field";
import {Input} from "~/components/ui/input";
import {Tabs, TabsList, TabsTrigger} from "~/components/ui/tabs";
import {Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "~/components/ui/dialog";
import {Alert} from "~/components/ui/alert";
import {detectFaceKeypoints} from "~~/utils/align-face.client";
import {AlertCircleIcon} from 'lucide-vue-next'
import {Spinner} from "~/components/ui/spinner";

const props = defineProps<{
  class?: string;
}>();

const router = useRouter();
const faceList = ref<string[]>([]);
const loading = ref(false);
const newName = ref("");
const uploadInputRef = ref<HTMLInputElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const streamRef = ref<MediaStream | null>(null);
const captureCanvasRef = ref<HTMLCanvasElement | null>(null);
const adding = ref(false);
const addError = ref("");
const editName = ref<string | null>(null);
const editValue = ref("");
const uploadDialogOpen = ref(false);
const cameraDialogOpen = ref(false);
const addMode = ref<"upload" | "camera">("upload");
const selectedImageDataUrl = ref<string | null>(null);

function handleTabChange(value: string) {
  if (value === "index") router.push("/");
}

async function loadFaces() {
  loading.value = true;
  try {
    const {names} = await $fetch<{ names: string[] }>("/api/faces");
    faceList.value = names ?? [];
  } catch (e) {
    console.error(e);
    faceList.value = [];
  } finally {
    loading.value = false;
  }
}

async function deleteFace(name: string) {
  if (!confirm(`确定删除「${name}」？`)) return;
  try {
    await $fetch(`/api/faces/${encodeURIComponent(name)}`, {method: "DELETE"});
    await loadFaces();
  } catch (e) {
    console.error(e);
    alert("删除失败");
  }
}

function startRename(name: string) {
  editName.value = name;
  editValue.value = name;
}

function cancelRename() {
  editName.value = null;
  editValue.value = "";
}

async function submitRename() {
  if (!editName.value || !editValue.value.trim()) {
    cancelRename();
    return;
  }
  const newNameVal = editValue.value.trim();
  if (newNameVal === editName.value) {
    cancelRename();
    return;
  }
  try {
    await $fetch(`/api/faces/${encodeURIComponent(editName.value)}`, {
      method: "PATCH",
      body: {newName: newNameVal},
    });
    await loadFaces();
    cancelRename();
  } catch (e) {
    console.error(e);
    alert("改名失败");
  }
}

async function getKeypointsFromImage(img: HTMLImageElement) {
  return await detectFaceKeypoints(img);
}

async function addFaceFromImageData(dataUrl: string, name: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image load error"));
    img.src = dataUrl;
  });
  const keypoints = await getKeypointsFromImage(img);
  await $fetch("/api/faces", {
    method: "POST",
    body: {image: dataUrl, keypoints, name: name.trim()},
  });
}

function openUpload() {
  addMode.value = "upload";
  newName.value = "";
  addError.value = "";
  selectedImageDataUrl.value = null;
  uploadDialogOpen.value = true;
}

function triggerFileSelect() {
  uploadInputRef.value?.click();
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !file.type.startsWith("image/")) {
    addError.value = "请选择图片文件";
    selectedImageDataUrl.value = null;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedImageDataUrl.value = reader.result as string;
    addError.value = "";
  };
  reader.readAsDataURL(file);
}

async function submitUpload() {
  if (!selectedImageDataUrl.value) {
    addError.value = "请选择图片";
    return;
  }
  if (!newName.value.trim()) {
    addError.value = "请输入姓名";
    return;
  }
  adding.value = true;
  addError.value = "";
  try {
    await addFaceFromImageData(selectedImageDataUrl.value, newName.value);
    await loadFaces();
    uploadDialogOpen.value = false;
    newName.value = "";
    selectedImageDataUrl.value = null;
  } catch (err) {
    console.error(err);
    addError.value = err instanceof Error ? err.message : "添加失败，请确保画面中有清晰人脸";
  } finally {
    adding.value = false;
  }
}

async function startCameraCapture() {
  addMode.value = "camera";
  newName.value = "";
  addError.value = "";
  cameraDialogOpen.value = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {width: 640, height: 480, facingMode: "user"},
    });
    streamRef.value = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
    }
  } catch (e) {
    console.error(e);
    addError.value = "无法打开摄像头";
  }
}

function stopCameraCapture() {
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }
  if (videoRef.value) videoRef.value.srcObject = null;
  cameraDialogOpen.value = false;
}

async function captureAndAdd() {
  if (!videoRef.value || !captureCanvasRef.value || !newName.value.trim()) {
    addError.value = "请先输入姓名并确保摄像头已开启";
    return;
  }
  const video = videoRef.value;
  const canvas = captureCanvasRef.value;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  adding.value = true;
  addError.value = "";
  try {
    await addFaceFromImageData(dataUrl, newName.value);
    await loadFaces();
    stopCameraCapture();
    newName.value = "";
  } catch (err) {
    console.error(err);
    addError.value = err instanceof Error ? err.message : "添加失败，请确保画面中有清晰人脸";
  } finally {
    adding.value = false;
  }
}

onMounted(() => {
  loadFaces();
});
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-xl">
          <Tabs class="w-full self-center" default-value="manager" model-value="manager">
            <div class="flex justify-center">
              <TabsList>
                <TabsTrigger value="index" @click="handleTabChange('index')">
                  身份识别
                </TabsTrigger>
                <TabsTrigger value="manager">身份管理</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-6">
        <!-- 人脸列表 -->
        <div>
          <h3 class="text-sm font-medium mb-2">已有身份</h3>
          <div v-if="loading" class="text-muted-foreground text-sm py-4">加载中…</div>
          <ul v-else-if="faceList.length === 0" class="text-muted-foreground text-sm py-4">
            暂无已录入人脸，请上传或拍照添加。
          </ul>
          <ul v-else class="flex flex-col gap-2">
            <li
                v-for="name in faceList"
                :key="name"
                class="flex items-center justify-between rounded-md border bg-card px-2 py-2"
            >
              <template v-if="editName === name">
                <Input
                    v-model="editValue"
                    class="flex-1 mr-2"
                    placeholder="新姓名"
                    @keydown.enter="submitRename"
                    @keydown.escape="cancelRename"
                />
                <div class="flex gap-1">
                  <Button size="sm" variant="outline" @click="submitRename">确定</Button>
                  <Button size="sm" variant="outline" @click="cancelRename">取消</Button>
                </div>
              </template>
              <template v-else>
                <span class="font-medium">{{ name }}</span>
                <div class="flex gap-1">
                  <Button size="sm" variant="outline" @click="startRename(name)">改名</Button>
                  <Button size="sm" variant="outline" @click="deleteFace(name)">删除</Button>
                </div>
              </template>
            </li>
          </ul>
        </div>

        <div class="border-t pt-4">
          <h3 class="text-sm font-medium mb-4">新增人脸</h3>
          <div class="flex flex-wrap gap-2">
            <Dialog v-model:open="uploadDialogOpen">
              <DialogTrigger as-child>
                <Button type="button" @click="openUpload">
                  上传图片
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>上传图片添加人脸</DialogTitle>
                </DialogHeader>
                <div class="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>姓名</FieldLabel>
                      <Input v-model="newName" placeholder="输入姓名"/>
                    </Field>
                  </FieldGroup>
                  <input
                      ref="uploadInputRef"
                      accept="image/*"
                      class="hidden"
                      type="file"
                      @change="onFileSelected"
                  />
                  <Button class="w-full" type="button" variant="secondary" @click="triggerFileSelect">
                    选择图片
                  </Button>
                  <div class="flex gap-2">
                    <Button :disabled="adding" @click="submitUpload">
                      <Spinner v-if="adding" class="animate-spin"/>
                      添加
                    </Button>
                    <DialogClose as-child>
                      <Button variant="outline">取消</Button>
                    </DialogClose>
                  </div>
                  <Alert v-if="addError" variant="destructive">
                    <AlertCircleIcon/>
                    <AlertTitle>{{ addError }}</AlertTitle>
                  </Alert>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog v-model:open="cameraDialogOpen">
              <DialogTrigger as-child>
                <Button type="button" variant="outline" @click="startCameraCapture">
                  摄像头拍照
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>摄像头拍照添加人脸</DialogTitle>
                </DialogHeader>
                <div class="space-y-4">
                  <div class="rounded-lg overflow-hidden bg-muted w-full max-w-xs aspect-video mx-auto">
                    <video
                        ref="videoRef"
                        autoplay
                        class="w-full h-full object-cover"
                        muted
                        playsinline
                    />
                  </div>
                  <canvas ref="captureCanvasRef" class="hidden"/>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>姓名</FieldLabel>
                      <Input v-model="newName" placeholder="输入姓名"/>
                    </Field>
                  </FieldGroup>
                  <div class="flex gap-2">
                    <Button :disabled="adding" @click="captureAndAdd">
                      <Spinner v-if="adding" class="animate-spin"/>
                      拍照并添加
                    </Button>
                    <DialogClose as-child>
                      <Button variant="outline">取消</Button>
                    </DialogClose>
                  </div>
                  <Alert v-if="addError" variant="destructive">
                    <AlertCircleIcon/>
                    <AlertTitle>{{ addError }}</AlertTitle>
                  </Alert>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
