import * as THREE from 'three';

export class InputManager {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseWorldPos = new THREE.Vector3();
        this.leftMouseDown = false;
        this.rightMouseDown = false;

        // Click targets
        this.clickedTile = null;
        this.hoveredTile = null;
        this.hoveredEnemy = null;

        // Raycaster for mouse picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Key states for abilities
        this.keys = {};

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
        this.keys[key] = true;

        // Only handle ability inputs when playing
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        switch (key) {
            case 'tab':
                e.preventDefault();
                this.game.targetClosestEnemy();
                break;

            case 'escape':
                this.game.clearTarget();
                break;

            case 'q':
                // Q ability - Cleave
                this.game.player.useCleave(this.game.enemies);
                break;

            case 'w':
                // W ability - Bladestorm
                this.game.player.useBladestorm();
                break;

            case 'e':
                // E ability - Parry
                this.game.player.useParry();
                break;

            case 'r':
                // R ability - Charge
                this.game.player.useCharge();
                break;

            case '1':
                this.game.player.usePotion();
                break;

            case 'c':
                // Toggle camera mode (if implemented)
                break;
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        this.updateMousePosition(e);

        if (e.button === 0) { // Left click - move to position
            this.leftMouseDown = true;
            this.handleLeftClick();
        } else if (e.button === 2) { // Right click - target enemy
            this.rightMouseDown = true;
            this.handleRightClick();
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            this.leftMouseDown = false;
        } else if (e.button === 2) {
            this.rightMouseDown = false;
        }
    }

    onMouseMove(e) {
        this.updateMousePosition(e);

        // Update hovered tile
        if (this.game.tileMap) {
            const tile = this.game.tileMap.worldToTile(this.mouseWorldPos.x, this.mouseWorldPos.z);
            this.hoveredTile = tile;
            this.game.tileMap.showHoverAt(tile.x, tile.y);
        }

        // Check for hovered enemy
        this.updateHoveredEnemy();

        // If holding left mouse, keep moving
        if (this.leftMouseDown && this.game.player) {
            this.handleLeftClick();
        }
    }

    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to ground plane
        if (this.game.camera) {
            this.raycaster.setFromCamera(this.mouse, this.game.camera);

            // Intersect with ground plane (y = 0)
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(groundPlane, intersectPoint);

            if (intersectPoint) {
                this.mouseWorldPos.copy(intersectPoint);
            }
        }
    }

    handleLeftClick() {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        // Move player to clicked position
        const targetTile = this.game.tileMap.worldToTile(this.mouseWorldPos.x, this.mouseWorldPos.z);

        if (this.game.tileMap.isWalkable(targetTile.x, targetTile.y)) {
            const worldPos = this.game.tileMap.tileToWorld(targetTile.x, targetTile.y);
            this.game.player.setMoveTarget(worldPos.x, worldPos.z);
        }
    }

    handleRightClick() {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        // Check if clicking on an enemy to target them
        const clickedEnemy = this.getEnemyAtMouse();

        if (clickedEnemy) {
            this.game.player.setTarget(clickedEnemy);
            this.game.updateTargetFrame(clickedEnemy);
        } else {
            // Clear target if clicking empty space
            this.game.clearTarget();
        }
    }

    updateHoveredEnemy() {
        this.hoveredEnemy = this.getEnemyAtMouse();

        // Update cursor style
        if (this.hoveredEnemy) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    getEnemyAtMouse() {
        if (!this.game.enemies) return null;

        // Check distance to each enemy
        for (const enemy of this.game.enemies) {
            if (!enemy.isAlive) continue;

            const enemyPos = enemy.position;
            const dx = this.mouseWorldPos.x - enemyPos.x;
            const dz = this.mouseWorldPos.z - enemyPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Click within 1.5 units of enemy
            if (dist < 1.5) {
                return enemy;
            }
        }

        return null;
    }

    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        if (this.game.cameraController) {
            this.game.cameraController.handleScroll(delta);
        }
    }
}
