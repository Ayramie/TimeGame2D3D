import * as THREE from 'three';
import { Player } from './player.js';
import { Mage } from './mage.js';
import { IsometricCamera } from './camera.js';
import { InputManager } from './input.js';
import { Enemy, SlimeEnemy, GreaterSlimeEnemy, SlimeBoss, SkeletonEnemy } from './enemy.js';
import { EffectsManager } from './effects.js';
import { ParticleSystem } from './particles.js';
import { TileMap } from './tileMap.js';
import { DungeonBuilder } from './dungeonBuilder.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.clock = new THREE.Clock();

        // Three.js core - PERFORMANCE OPTIMIZED
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // Fixed at 1 for performance
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Fastest shadow type

        // Sky gradient - create a simple gradient background
        this.scene.background = new THREE.Color(0x88bbee);
        this.scene.fog = new THREE.FogExp2(0x88bbee, 0.008);

        // Game state
        this.gameState = 'menu'; // 'menu' or 'playing'
        this.gameMode = null; // 'mobbing' or 'boss'
        this.selectedClass = 'warrior'; // 'warrior' or 'mage'
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.damageNumbers = [];
        this.groundHazards = [];

        // Effects manager
        this.effects = new EffectsManager(this.scene);

        // Setup menu handlers
        this.setupMenu();

        // Handle window resize
        window.addEventListener('resize', () => this.onResize());
    }

    setupMenu() {
        const menuBtns = document.querySelectorAll('.menu-btn');
        menuBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.startGame(mode);
            });
        });

        // Character selection buttons
        const classBtns = document.querySelectorAll('.class-btn');
        classBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selected from all
                classBtns.forEach(b => b.classList.remove('selected'));
                // Add selected to clicked
                btn.classList.add('selected');
                this.selectedClass = btn.dataset.class;
            });
        });

        const returnBtn = document.getElementById('return-menu-btn');
        returnBtn.addEventListener('click', () => {
            this.returnToMenu();
        });
    }

    async startGame(mode) {
        this.gameMode = mode;
        this.gameState = 'loading';

        // Hide menu, show loading text, hide canvas during load
        const menu = document.getElementById('main-menu');
        menu.innerHTML = '<h1>Loading...</h1>';
        this.canvas.style.opacity = '0';

        // Clear previous game state
        this.clearScene();

        // Setup fresh game
        await this.setupScene();
        this.setupLighting();
        this.setupPlayer();

        // Wait for character to load before continuing
        if (this.player && this.player.character) {
            // Wait for character loading to complete
            while (this.player.characterLoading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        this.setupCamera();
        this.setupInput();
        this.spawnEnemies();

        // Create particle system
        this.particles = new ParticleSystem(this.scene);

        // Screen shake
        this.screenShake = { intensity: 0, decay: 0.9 };

        // Ambient particle timer
        this.ambientTimer = 0;

        // Now show UI and canvas
        this.gameState = 'playing';
        this.canvas.style.opacity = '1';
        menu.classList.add('hidden');
        menu.innerHTML = `
            <h1>TileGame 3D</h1>
            <div class="class-selection">
                <h3>Choose Class</h3>
                <div class="class-buttons">
                    <button class="class-btn selected" data-class="warrior">⚔️ Warrior</button>
                    <button class="class-btn" data-class="mage">🔮 Mage</button>
                </div>
            </div>
            <div class="menu-options">
                <button class="menu-btn" data-mode="mobbing">Mobbing</button>
                <button class="menu-btn" data-mode="boss">Slime Boss</button>
            </div>
        `;
        document.getElementById('ui').style.display = 'block';
        document.getElementById('return-menu-btn').style.display = 'block';

        // Update ability bar labels based on class
        this.updateAbilityLabels();

        // Re-attach menu handlers since we replaced innerHTML
        this.setupMenu();
    }

    updateAbilityLabels() {
        if (this.selectedClass === 'mage') {
            document.querySelector('#ability-q .name').textContent = 'Blizzard';
            document.querySelector('#ability-2 .name').textContent = 'Flame Wave';
            document.querySelector('#ability-e .name').textContent = 'Burn Aura';
            document.querySelector('#ability-r .name').textContent = 'Backstep';
        } else {
            document.querySelector('#ability-q .name').textContent = 'Cleave';
            document.querySelector('#ability-2 .name').textContent = 'Bladestorm';
            document.querySelector('#ability-e .name').textContent = 'Leap';
            document.querySelector('#ability-r .name').textContent = 'Shockwave';
        }
    }

    returnToMenu() {
        this.gameState = 'menu';
        this.gameMode = null;

        // Show menu, hide UI
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('ui').style.display = 'none';
        document.getElementById('return-menu-btn').style.display = 'none';
        document.getElementById('target-frame').style.display = 'none';

        // Clear the scene
        this.clearScene();
    }

    clearScene() {
        // Remove all objects from scene
        while (this.scene.children.length > 0) {
            const obj = this.scene.children[0];
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }

        this.enemies = [];
        this.projectiles = [];
        this.groundHazards = [];

        // Dispose environment
        if (this.environment) {
            this.environment.dispose();
            this.environment = null;
        }

        // Dispose dungeon
        if (this.dungeon) {
            this.dungeon.dispose();
            this.dungeon = null;
        }
    }

    async setupScene() {
        if (this.gameMode === 'mobbing') {
            // Create dungeon for mobbing mode
            this.dungeon = new DungeonBuilder(this.scene);
            await this.dungeon.loadModels();
            this.dungeon.generate();
            this.dungeon.build();

            // Use dungeon for walkability checks
            const tileSize = this.dungeon.tileSize;
            this.tileMap = {
                isWalkable: (tileX, tileY) => {
                    // Direct tile check - no coordinate conversion needed
                    return this.dungeon.isTileWalkable(tileX, tileY);
                },
                worldToTile: (x, z) => this.dungeon.worldToTile(x, z),
                tileToWorld: (x, y) => this.dungeon.tileToWorld(x, y),
                showHoverAt: () => {},
                dispose: () => {},
                width: this.dungeon.width,
                height: this.dungeon.height,
                tileSize: tileSize
            };

            // Dark dungeon atmosphere - NO fog for performance
            this.scene.background = new THREE.Color(0x2a2a3e);
            this.scene.fog = null;
        } else {
            // Boss mode uses simple tile map
            this.tileMap = new TileMap(this.scene);
        }
    }

    setupLighting() {
        // Ambient light - brighter for visibility
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        // Main directional light - OPTIMIZED shadows
        const sun = new THREE.DirectionalLight(0xfff4e5, 1.0);
        sun.position.set(30, 50, 30);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 512;  // Much smaller for performance
        sun.shadow.mapSize.height = 512;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -40;
        sun.shadow.camera.right = 40;
        sun.shadow.camera.top = 40;
        sun.shadow.camera.bottom = -40;
        this.scene.add(sun);

        // Single hemisphere light instead of multiple lights
        const hemi = new THREE.HemisphereLight(0x88ccff, 0x444422, 0.4);
        this.scene.add(hemi);
    }

    setupPlayer() {
        // Create player based on selected class
        if (this.selectedClass === 'mage') {
            this.player = new Mage(this.scene, this, 'mage');
        } else {
            this.player = new Player(this.scene, this, 'warrior');
        }

        // Set spawn position based on game mode
        if (this.gameMode === 'mobbing' && this.dungeon) {
            const spawn = this.dungeon.getSpawnPosition();
            this.player.position.set(spawn.x, 0, spawn.z);
        } else {
            this.player.position.set(15, 0, 15);
        }
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Use isometric camera for tile-based gameplay
        this.cameraController = new IsometricCamera(this.camera);

        // Center camera on player spawn - snap immediately
        if (this.player) {
            this.cameraController.setTarget(this.player.position.clone(), true);
        } else {
            this.cameraController.setTarget(new THREE.Vector3(15, 0, 15), true);
        }
    }

    setupInput() {
        this.input = new InputManager(this.canvas, this);
    }

    spawnEnemies() {
        if (this.gameMode === 'boss') {
            // Spawn the Slime Boss at tile position
            const boss = new SlimeBoss(this.scene, this, 15, 25);
            boss.name = 'Slime Boss';
            this.enemies.push(boss);
        } else if (this.gameMode === 'mobbing' && this.dungeon) {
            // Mobbing mode - spawn enemies in each room
            const spawnPositions = this.dungeon.getEnemySpawnPositions(6);
            const skeletonTypes = ['warrior', 'mage'];

            for (let i = 0; i < spawnPositions.length; i++) {
                const pos = spawnPositions[i];

                // Alternate between slimes and skeletons
                if (i % 2 === 0) {
                    const slime = new SlimeEnemy(this.scene, pos.x, pos.z, this);
                    this.enemies.push(slime);
                } else {
                    const skeletonType = skeletonTypes[i % skeletonTypes.length];
                    const skeleton = new SkeletonEnemy(this.scene, pos.x, pos.z, skeletonType, this);
                    skeleton.name = `Skeleton ${skeletonType.charAt(0).toUpperCase() + skeletonType.slice(1)}`;
                    this.enemies.push(skeleton);
                }
            }

            // Spawn a Greater Slime boss in the last room
            if (this.dungeon.rooms.length > 1) {
                const lastRoom = this.dungeon.rooms[this.dungeon.rooms.length - 1];
                const bossX = lastRoom.centerX * this.dungeon.tileSize;
                const bossZ = lastRoom.centerY * this.dungeon.tileSize;
                const boss = new GreaterSlimeEnemy(this.scene, bossX, bossZ, this);
                boss.name = 'Greater Slime';
                this.enemies.push(boss);
            }
        } else {
            // Fallback for other modes
            const slimePositions = [
                [8, 8], [12, 6], [20, 10], [22, 18]
            ];

            for (const [x, z] of slimePositions) {
                const slime = new SlimeEnemy(this.scene, x, z, this);
                this.enemies.push(slime);
            }
        }
    }

    targetClosestEnemy() {
        if (this.enemies.length === 0) return;

        const playerPos = this.player.position;
        let closest = null;
        let closestDist = Infinity;

        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;
            if (this.player.targetEnemy === enemy) continue; // Skip current target

            const dist = playerPos.distanceTo(enemy.position);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        }

        if (closest) {
            this.player.setTarget(closest);
        } else if (this.enemies.some(e => e.isAlive)) {
            // If we skipped current target and it's the only one, re-target it
            const aliveEnemy = this.enemies.find(e => e.isAlive);
            if (aliveEnemy) this.player.setTarget(aliveEnemy);
        }
    }

    clearTarget() {
        this.player.setTarget(null);
    }

    addProjectile(position, direction, damage, range, type, owner) {
        // Create visual mesh based on type
        let mesh;
        if (type === 'slash') {
            // Slash projectile - elongated glowing blade
            const geometry = new THREE.BoxGeometry(0.15, 0.6, 1.5);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.9
            });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
            mesh.rotation.y = Math.atan2(direction.x, direction.z);

            // Add glow trail
            const trailGeometry = new THREE.BoxGeometry(0.1, 0.4, 1.2);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: 0xffdd88,
                transparent: true,
                opacity: 0.6
            });
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            trail.position.z = -0.3;
            mesh.add(trail);
        } else {
            // Default sphere projectile
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0xff6600 });
            mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position);
        }

        const projectile = {
            mesh: mesh,
            position: position.clone(),
            direction: direction.normalize(),
            speed: 18,
            damage: damage,
            range: range,
            traveled: 0,
            alive: true,
            owner: owner,
            update: function(dt) {
                const move = this.direction.clone().multiplyScalar(this.speed * dt);
                this.position.add(move);
                this.mesh.position.copy(this.position);
                this.traveled += this.speed * dt;
                if (this.traveled >= this.range) {
                    this.alive = false;
                }
            },
            checkHit: function(enemy) {
                const dist = this.position.distanceTo(enemy.position);
                return dist < 1.2;
            }
        };

        this.projectiles.push(projectile);
        this.scene.add(mesh);
    }

    addDamageNumber(position, damage, isHeal = false) {
        this.damageNumbers.push({
            position: position.clone(),
            damage,
            isHeal,
            life: 1.0,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                5,
                (Math.random() - 0.5) * 2
            )
        });
    }

    update(deltaTime) {
        // Skip updates if not playing
        if (this.gameState !== 'playing') return;

        // Update input (WASD movement)
        if (this.input) {
            this.input.update(deltaTime);
        }

        // Update player (click-to-move)
        this.player.update(deltaTime);

        // Update cleave indicator while aiming
        if (this.input && this.input.isAiming() && this.player.updateCleaveIndicator) {
            const aimDir = this.input.getAimDirection(this.player.position);
            this.player.updateCleaveIndicator(aimDir);
        }

        // Update camera to follow player
        this.cameraController.setTarget(this.player.position);
        this.cameraController.update(deltaTime);

        // Update enemies
        for (const enemy of this.enemies) {
            if (enemy.isAlive) {
                enemy.update(deltaTime, this.player, this.camera);
            }

            // Check for hit particles
            if (enemy.lastHitPosition && this.particles) {
                const isBoss = enemy.constructor.name === 'SlimeBoss';
                const isGreater = enemy.constructor.name === 'GreaterSlimeEnemy';

                if (isBoss || isGreater) {
                    this.particles.purpleSlimeHit(enemy.lastHitPosition, enemy.lastHitAmount / 20);
                } else {
                    this.particles.slimeHit(enemy.lastHitPosition, enemy.lastHitAmount / 15);
                }

                // Screen shake based on damage
                this.addScreenShake(Math.min(enemy.lastHitAmount / 30, 0.5));

                enemy.lastHitPosition = null;
                enemy.lastHitAmount = null;
            }

            // Check for death particles
            if (enemy.justDied && this.particles) {
                const isBoss = enemy.constructor.name === 'SlimeBoss';
                const isGreater = enemy.constructor.name === 'GreaterSlimeEnemy';

                if (isBoss) {
                    this.particles.deathExplosion(enemy.deathPosition, 0x8844aa, 3);
                    this.addScreenShake(2);
                } else if (isGreater) {
                    this.particles.deathExplosion(enemy.deathPosition, 0x8844aa, 1.5);
                    this.addScreenShake(1);
                } else {
                    this.particles.deathExplosion(enemy.deathPosition, 0x44dd44, 1);
                    this.addScreenShake(0.5);
                }

                enemy.justDied = false;
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(deltaTime);

            // Check collision with enemies
            for (const enemy of this.enemies) {
                if (enemy.isAlive && proj.checkHit(enemy)) {
                    enemy.takeDamage(proj.damage, this.player);
                    this.effects.createDamageNumber(enemy.position, proj.damage);
                    proj.alive = false;
                }
            }

            if (!proj.alive) {
                this.scene.remove(proj.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // Update damage numbers
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const dn = this.damageNumbers[i];
            dn.life -= deltaTime * 1.5;
            dn.velocity.y -= deltaTime * 10; // Gravity
            dn.position.add(dn.velocity.clone().multiplyScalar(deltaTime));

            if (dn.life <= 0) {
                this.damageNumbers.splice(i, 1);
            }
        }

        // Check player collision with enemies
        this.checkPlayerEnemyCollision();

        // Update effects
        this.effects.update(deltaTime);

        // Update particles
        if (this.particles) {
            this.particles.update(deltaTime);


            // Fire pool effects
            for (const hazard of this.groundHazards) {
                if (hazard.type === 'fire' && Math.random() < 0.3) {
                    this.particles.firePoolEffect(hazard.position);
                } else if (hazard.type === 'poison' && Math.random() < 0.2) {
                    this.particles.poisonPoolEffect(hazard.position);
                }
            }
        }

        // Update screen shake
        if (this.screenShake && this.screenShake.intensity > 0) {
            this.screenShake.intensity *= this.screenShake.decay;
            if (this.screenShake.intensity < 0.01) {
                this.screenShake.intensity = 0;
            }
        }

        // Update ground hazards
        this.updateGroundHazards(deltaTime);

        // Update UI
        this.updateUI();
    }

    updateGroundHazards(deltaTime) {
        for (let i = this.groundHazards.length - 1; i >= 0; i--) {
            const hazard = this.groundHazards[i];

            // Update duration
            hazard.duration -= deltaTime;

            // Fade out as duration decreases
            if (hazard.mesh && hazard.mesh.material) {
                const baseOpacity = hazard.type === 'fire' ? 0.6 : 0.5;
                hazard.mesh.material.opacity = Math.min(baseOpacity, hazard.duration * 0.3);
            }

            // Check for player damage (tick every 0.5s)
            hazard.tickTimer += deltaTime;
            if (hazard.tickTimer >= 0.5) {
                hazard.tickTimer = 0;

                const dist = this.player.position.distanceTo(hazard.position);
                if (dist < hazard.radius) {
                    this.player.takeDamage(hazard.damage);
                    this.effects.createDamageNumber(this.player.position, hazard.damage, false);
                }
            }

            // Remove expired hazards
            if (hazard.duration <= 0) {
                if (hazard.mesh) {
                    this.scene.remove(hazard.mesh);
                    if (hazard.mesh.geometry) hazard.mesh.geometry.dispose();
                    if (hazard.mesh.material) hazard.mesh.material.dispose();
                }
                this.groundHazards.splice(i, 1);
            }
        }
    }

    checkPlayerEnemyCollision() {
        for (const enemy of this.enemies) {
            if (!enemy.isAlive) continue;

            // Skip boss - boss only uses telegraphed special attacks
            if (enemy instanceof SlimeBoss) continue;

            const dist = this.player.position.distanceTo(enemy.position);
            if (dist < 1.5) {
                enemy.tryAttack(this.player);
            }
        }
    }

    updateUI() {
        // Health bar
        const healthPercent = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('health-fill').style.width = `${healthPercent}%`;
        document.getElementById('health-text').textContent =
            `${Math.ceil(this.player.health)} / ${this.player.maxHealth}`;

        // Target frame
        const targetFrame = document.getElementById('target-frame');
        if (this.player.targetEnemy && this.player.targetEnemy.isAlive) {
            targetFrame.style.display = 'block';
            document.getElementById('target-name').textContent =
                this.player.targetEnemy.name || 'Slime';
            const targetHealthPercent =
                (this.player.targetEnemy.health / this.player.targetEnemy.maxHealth) * 100;
            document.getElementById('target-health-fill').style.width = `${targetHealthPercent}%`;
        } else {
            targetFrame.style.display = 'none';
        }

        // Ability cooldowns - different for each class
        if (this.selectedClass === 'mage') {
            this.updateAbilityCooldown('q', this.player.abilities.blizzard);
            this.updateAbilityCooldown('2', this.player.abilities.flameWave);
            this.updateAbilityCooldown('e', this.player.abilities.burnAura);
            this.updateAbilityCooldown('r', this.player.abilities.backstep);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        } else {
            this.updateAbilityCooldown('q', this.player.abilities.cleave);
            this.updateAbilityCooldown('2', this.player.abilities.bladestorm);
            this.updateAbilityCooldown('e', this.player.abilities.leap);
            this.updateAbilityCooldown('r', this.player.abilities.shockwave);
            this.updateAbilityCooldown('1', this.player.abilities.potion);
        }
    }

    updateAbilityCooldown(key, ability) {
        const element = document.getElementById(`ability-${key}`);
        if (!element || !ability) return;

        const overlay = element.querySelector('.cooldown-overlay');
        if (ability.cooldownRemaining > 0) {
            element.classList.add('on-cooldown');
            const percent = (ability.cooldownRemaining / ability.cooldown) * 100;
            overlay.style.height = `${percent}%`;
        } else {
            element.classList.remove('on-cooldown');
            overlay.style.height = '0%';
        }

        if (ability.isActive) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }

        if (ability.isCharging) {
            element.classList.add('charging');
        } else {
            element.classList.remove('charging');
        }
    }

    render() {
        // Skip render if in menu or no camera
        if (this.gameState === 'menu' || !this.camera) return;

        // Apply screen shake (temporary offset, then restore)
        let shakeX = 0, shakeY = 0;
        if (this.screenShake && this.screenShake.intensity > 0.01) {
            shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.position.x += shakeX;
            this.camera.position.y += shakeY;
        }

        this.renderer.render(this.scene, this.camera);

        // Restore camera position
        if (shakeX !== 0 || shakeY !== 0) {
            this.camera.position.x -= shakeX;
            this.camera.position.y -= shakeY;
        }
    }

    addScreenShake(intensity) {
        if (this.screenShake) {
            // Reduce intensity significantly
            this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity * 0.15);
        }
    }

    onResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    start() {
        const gameLoop = () => {
            const deltaTime = Math.min(this.clock.getDelta(), 0.1);
            this.update(deltaTime);
            this.render();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
}
