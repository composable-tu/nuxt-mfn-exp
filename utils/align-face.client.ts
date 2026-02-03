export async function detectFaceKeypoints(imageElement: HTMLImageElement) {
    const {FaceDetector, FilesetResolver} = await import('@mediapipe/tasks-vision');

    // 初始化检测器
    const vision = await FilesetResolver.forVisionTasks("/models/mediapipe");

    const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `/models/litert/blaze_face_short_range.tflite`, delegate: "GPU"
        }, runningMode: "IMAGE"
    });

    const result = detector.detect(imageElement);

    if (!result.detections.length) {
        throw new Error("No face detected");
    }

    const keypoints = result.detections[0].keypoints;
    const {naturalWidth: w, naturalHeight: h} = imageElement;

    // 映射回原始像素尺寸，仅提取前4个点（左右眼、鼻、嘴中心）
    return keypoints.slice(0, 4).map(kp => ({
        x: kp.x * w, y: kp.y * h
    }));
}

