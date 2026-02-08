export async function detectFaceKeypoints(imageElement: HTMLImageElement) {
    const {FaceDetector, FilesetResolver} = await import('@mediapipe/tasks-vision');

    const vision = await FilesetResolver.forVisionTasks("/mediapipe");

    const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `litert/blaze_face_short_range.tflite`, delegate: "GPU"
        }, runningMode: "IMAGE"
    });

    const result = detector.detect(imageElement);

    if (!result.detections.length) {
        throw new Error("No face detected");
    }

    const keypoints = result.detections[0].keypoints;
    const {naturalWidth: w, naturalHeight: h} = imageElement;

    const toPx = (kp: { x: number; y: number }) => ({x: kp.x * w, y: kp.y * h});
    return [toPx(keypoints[0]), toPx(keypoints[1]), toPx(keypoints[2]), toPx(keypoints[3]),];
}

