import * as THREE from 'three';

export class InputManager {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;

        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseWorldPos = new THREE.Vector3();
        this.leftMouseDown = false;
        this.rightMouseDown = false;

        // Camera rotation state
        this.isRotatingCamera = false;
        this.rightClickStartX = 0;
        this.rightClickStartY = 0;
        this.rotationThreshold = 5; // Pixels moved before it counts as rotation

        // Click targets
        this.clickedTile = null;
        this.hoveredTile = null;
        this.hoveredEnemy = null;

        // Raycaster for mouse picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Key states for abilities and movement
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
                // Q ability - Cleave (warrior, skillshot) or Blizzard (mage, targeted)
                if (this.game.player.showCleaveIndicator) {
                    // Warrior: hold to aim cleave
                    this.aimingAbility = 'q';
                    this.game.player.showCleaveIndicator(true);
                } else if (this.game.player.useBlizzard) {
                    // Mage: cast blizzard at mouse position
                    this.game.player.useBlizzard(this.mouseWorldPos.clone());
                }
                break;

            case 'e':
                // E ability - Leap (warrior) or Burn Aura toggle (mage)
                if (this.game.player.useLeap) {
                    this.game.player.useLeap(this.mouseWorldPos.x, this.mouseWorldPos.z);
                } else if (this.game.player.toggleBurnAura) {
                    this.game.player.toggleBurnAura();
                }
                break;

            case 'r':
                // R ability - Shockwave (warrior) or Backstep (mage)
                if (this.game.player.useShockwave) {
                    const dir = this.getAimDirection(this.game.player.position);
                    this.game.player.useShockwave(dir);
                } else if (this.game.player.useBackstep) {
                    this.game.player.useBackstep();
                }
                break;

            case '1':
                this.game.player.usePotion();
                break;

            case '2':
                // 2 ability - Bladestorm (warrior) or Flame Wave (mage)
                if (this.game.player.useBladestorm) {
                    this.game.player.useBladestorm();
                } else if (this.game.player.useFlameWave) {
                    this.game.player.useFlameWave(this.game.enemies);
                }
                break;

            case 'c':
                // Toggle camera mode (if implemented)
                break;

            // WASD keys are handled in update() for continuous movement
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
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.updateMousePosition(e);

        if (e.button === 0) { // Left click - move to position
            this.leftMouseDown = true;
            this.handleLeftClick();
        } else if (e.button === 2) { // Right click - start potential camera rotation
            this.rightMouseDown = true;
            this.rightClickStartX = e.clientX;
            this.rightClickStartY = e.clientY;
            this.isRotatingCamera = false;
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            this.leftMouseDown = false;
        } else if (e.button === 2) {
            // If we didn't rotate (just a click), handle targeting
            if (!this.isRotatingCamera) {
                this.handleRightClick();
            }
            this.rightMouseDown = false;
            this.isRotatingCamera = false;
        }
    }

    onMouseMove(e) {
        const deltaX = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.updateMousePosition(e);

        // Handle camera rotation with right-click drag
        if (this.rightMouseDown) {
            const totalDragX = Math.abs(e.clientX - this.rightClickStartX);
            const totalDragY = Math.abs(e.clientY - this.rightClickStartY);

            // Check if we've moved enough to start rotating
            if (totalDragX > this.rotationThreshold || totalDragY > this.rotationThreshold) {
                this.isRotatingCamera = true;
            }

            // Rotate camera
            if (this.isRotatingCamera && this.game.cameraController) {
                this.game.cameraController.rotate(deltaX);
            }
        }

        // Update hovered tile (only if not rotating camera)
        if (!this.isRotatingCamera && this.game.tileMap) {
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

    // Called each frame to handle WASD movement
    update(deltaTime) {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        // Check for WASD input
        const w = this.keys['w'] || this.keys['arrowup'];
        const a = this.keys['a'] || this.keys['arrowleft'];
        const s = this.keys['s'] || this.keys['arrowdown'];
        const d = this.keys['d'] || this.keys['arrowright'];

        if (w || a || s || d) {
            // Clear click-to-move target when using WASD
            this.game.player.clearMoveTarget();

            // Get camera-relative directions
            const forward = this.game.cameraController.getForwardDirection();
            const right = this.game.cameraController.getRightDirection();

            // Calculate movement direction
            let moveX = 0;
            let moveZ = 0;

            if (w) {
                moveX += forward.x;
                moveZ += forward.z;
            }
            if (s) {
                moveX -= forward.x;
                moveZ -= forward.z;
            }
            if (d) {
                moveX += right.x;
                moveZ += right.z;
            }
            if (a) {
                moveX -= right.x;
                moveZ -= right.z;
            }

            // Normalize if moving diagonally
            const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
            if (len > 0) {
                moveX /= len;
                moveZ /= len;

                // Apply movement
                const speed = this.game.player.moveSpeed * deltaTime;
                const newX = this.game.player.position.x + moveX * speed;
                const newZ = this.game.player.position.z + moveZ * speed;

                // Check walkability
                if (this.game.player.canMoveTo(newX, newZ)) {
                    this.game.player.position.x = newX;
                    this.game.player.position.z = newZ;
                } else {
                    // Try sliding along walls
                    if (this.game.player.canMoveTo(newX, this.game.player.position.z)) {
                        this.game.player.position.x = newX;
                    } else if (this.game.player.canMoveTo(this.game.player.position.x, newZ)) {
                        this.game.player.position.z = newZ;
                    }
                }

                // Face movement direction
                this.game.player.rotation = Math.atan2(moveX, moveZ);

                // Mark as moving for animation
                this.game.player.isMoving = true;
            }
        }
    }

    // Check if player is moving via WASD
    isWASDMoving() {
        return this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d'] ||
               this.keys['arrowup'] || this.keys['arrowleft'] || this.keys['arrowdown'] || this.keys['arrowright'];
    }
}
