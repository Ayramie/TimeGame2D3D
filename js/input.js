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

        // Skillshot aiming state
        this.aimingAbility = null;

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
                // Q ability - Cleave (skillshot - hold to aim, release to fire)
                if (this.game.player.showCleaveIndicator) {
                    this.aimingAbility = 'q';
                    this.game.player.showCleaveIndicator(true);
                }
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

        // Fire cleave skillshot on Q release
        if (key === 'q' && this.aimingAbility === 'q') {
            this.aimingAbility = null;
            if (this.game.player.showCleaveIndicator) {
                this.game.player.showCleaveIndicator(false);
            }
            if (this.game.player.useCleaveSkillshot) {
                // Get direction from player to mouse
                const dir = {
                    x: this.mouseWorldPos.x - this.game.player.position.x,
                    z: this.mouseWorldPos.z - this.game.player.position.z
                };
                const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
                if (len > 0) {
                    dir.x /= len;
                    dir.z /= len;
                }
                this.game.player.useCleaveSkillshot(dir, this.game.enemies);
            }
        }
    }

    // Check if currently aiming a skillshot
    isAiming() {
        return this.aimingAbility !== null;
    }

    // Get aim direction from player to mouse
    getAimDirection(playerPos) {
        const dx = this.mouseWorldPos.x - playerPos.x;
        const dz = this.mouseWorldPos.z - playerPos.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0) {
            return { x: dx / len, z: dz / len };
        }
        return { x: 0, z: 1 };
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
            // Target frame UI is updated automatically in game.updateUI()
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
