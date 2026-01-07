import * as THREE from 'three';

// Fixed isometric camera for tile-based gameplay
export class IsometricCamera {
    constructor(camera) {
        this.camera = camera;

        // Camera settings for isometric view
        this.height = 20;
        this.distance = 15;
        this.angle = Math.PI / 4; // 45 degree angle for isometric (yaw rotation)

        // Target position (follows player smoothly)
        this.targetPosition = new THREE.Vector3(0, 0, 0);
        this.currentPosition = new THREE.Vector3(0, 0, 0);

        // Smoothing
        this.smoothing = 8;

        // Zoom settings
        this.zoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2;

        // Camera rotation (controlled by right-click drag)
        this.rotationSpeed = 0.005;

        // Initialize camera position
        this.updateCameraPosition();
    }

    // Rotate camera around player (yaw only)
    rotate(deltaX) {
        this.angle -= deltaX * this.rotationSpeed;
        // Keep angle in 0 to 2PI range
        while (this.angle < 0) this.angle += Math.PI * 2;
        while (this.angle >= Math.PI * 2) this.angle -= Math.PI * 2;
    }

    // Get the forward direction based on camera angle (for WASD movement)
    getForwardDirection() {
        return {
            x: -Math.sin(this.angle),
            z: -Math.cos(this.angle)
        };
    }

    // Get the right direction based on camera angle (for WASD movement)
    getRightDirection() {
        return {
            x: -Math.cos(this.angle),
            z: Math.sin(this.angle)
        };
    }

    setTarget(position, immediate = false) {
        this.targetPosition.copy(position);
        // Snap immediately if requested (useful for initial spawn)
        if (immediate) {
            this.currentPosition.copy(position);
            this.updateCameraPosition();
        }
    }

    handleScroll(delta) {
        this.zoom -= delta * 0.1;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    }

    updateCameraPosition() {
        // Calculate camera offset from target (isometric angle)
        const offsetX = Math.sin(this.angle) * this.distance / this.zoom;
        const offsetZ = Math.cos(this.angle) * this.distance / this.zoom;
        const offsetY = this.height / this.zoom;

        // Camera looks at target from isometric angle
        this.camera.position.set(
            this.currentPosition.x + offsetX,
            offsetY,
            this.currentPosition.z + offsetZ
        );

        this.camera.lookAt(this.currentPosition);
    }

    update(deltaTime) {
        // Smooth follow target
        const lerp = 1 - Math.exp(-this.smoothing * deltaTime);
        this.currentPosition.lerp(this.targetPosition, lerp);

        this.updateCameraPosition();
    }
}
