// C# uses top-left origin, +Y down and clockwise angles. Three uses +Y up.
export function viewport(width, height, pixelRatio = 1) {
    const minWidth = width < height ? 800 : 1100;
    const scale = Math.min(1, width / minWidth);
    return { width, height, pixelRatio: Math.min(pixelRatio, 2),
        logicalWidth: Math.round(width / scale), logicalHeight: Math.round(height / scale) };
}

export function place(object, entity, z = 0) {
    object.position.set(entity.x, -entity.y, z);
    object.rotation.z = -(entity.rotation || 0);
}

export function projectCamera(camera, width, height) {
    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = -height;
    camera.updateProjectionMatrix();
}
