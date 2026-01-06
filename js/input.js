import * as THREE from 'three';

export class InputManager {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;

        // Key states
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            ' ': false, // spacebar
            shift: false,
            arrowup: false,
            arrowdown: false,
            arrowleft: false,
            arrowright: false
        };

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.leftMouseDown = false;
        this.rightMouseDown = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();

        // Movement keys
        if (key in this.keys) {
            this.keys[key] = true;
        }

        // Handle special keys
        switch (key) {
            case 'tab':
                e.preventDefault();
                this.game.targetClosestEnemy();
                break;

            case 'escape':
                this.game.clearTarget();
                break;

            case 'q':
                // Q ability - Cleave (Warrior) / Blizzard (Mage)
                if (this.game.selectedClass === 'mage') {
                    // Blizzard targets the targeted enemy's position, or in front of player
                    let targetPos;
                    if (this.game.player.targetEnemy && this.game.player.targetEnemy.isAlive) {
                        targetPos = this.game.player.targetEnemy.position.clone();
                    } else {
                        // Default to in front of player
                        const forward = new THREE.Vector3(
                            Math.sin(this.game.player.rotation),
                            0,
                            Math.cos(this.game.player.rotation)
                        );
                        targetPos = this.game.player.position.clone().add(forward.multiplyScalar(8));
                    }
                    this.game.player.useBlizzard(targetPos);
                } else {
                    this.game.player.useCleave(this.game.enemies);
                }
                break;

            case 'f':
                // F ability - Bladestorm (Warrior) / Flame Wave (Mage)
                if (this.game.selectedClass === 'mage') {
                    this.game.player.useFlameWave(this.game.enemies);
                } else {
                    this.game.player.useBladestorm();
                }
                break;

            case 'e':
                // E ability - Parry (Warrior) / Burn Aura (Mage)
                if (this.game.selectedClass === 'mage') {
                    this.game.player.toggleBurnAura();
                } else {
                    this.game.player.useParry();
                }
                break;

            case 'r':
                // R ability - Charge (Warrior) / Backstep (Mage)
                if (this.game.selectedClass === 'mage') {
                    this.game.player.useBackstep();
                } else {
                    this.game.player.useCharge();
                }
                break;

            case '1':
                this.game.player.usePotion();
                break;
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();

        if (key in this.keys) {
            this.keys[key] = false;
        }
    }

    onMouseDown(e) {
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        if (e.button === 0) { // Left click
            this.leftMouseDown = true;
            // Request pointer lock for smooth camera orbit
            this.canvas.requestPointerLock();
        } else if (e.button === 2) { // Right click
            this.rightMouseDown = true;
            // Request pointer lock for unlimited turning
            this.canvas.requestPointerLock();
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            // If it was a quick click (not drag), do a free swing attack
            if (this.leftMouseDown && !this.wasDragging) {
                this.game.player.performAutoAttack();
            }
            this.leftMouseDown = false;
        } else if (e.button === 2) {
            this.rightMouseDown = false;
        }
        this.wasDragging = false;

        // Release pointer lock when no mouse buttons held
        if (!this.leftMouseDown && !this.rightMouseDown) {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    }

    onMouseMove(e) {
        // Use movementX/Y when pointer locked, otherwise calculate delta
        let deltaX, deltaY;
        if (document.pointerLockElement) {
            deltaX = e.movementX;
            deltaY = e.movementY;
        } else {
            deltaX = e.clientX - this.lastMouseX;
            deltaY = e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }

        // Track if we're dragging
        if ((this.leftMouseDown || this.rightMouseDown) && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
            this.wasDragging = true;
        }

        if (this.rightMouseDown) {
            // Right click drag: rotate character AND camera
            this.game.cameraController.rotateCharacter(deltaX, deltaY);
        } else if (this.leftMouseDown) {
            // Left click drag: rotate camera only (orbit)
            this.game.cameraController.rotateCamera(deltaX, deltaY);
        }
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        this.game.cameraController.handleScroll(delta);
    }

    // Check if any mouse button is held for camera rotation
    isRotating() {
        return this.leftMouseDown || this.rightMouseDown;
    }
}
