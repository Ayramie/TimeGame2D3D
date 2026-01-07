import * as THREE from 'three';
import { CharacterController } from './character.js';

/**
 * Base class for player characters (Warrior, Mage, etc.)
 * Contains shared movement, targeting, and character loading logic.
 */
export class PlayerBase {
    constructor(scene, game, characterClass) {
        this.scene = scene;
        this.game = game;
        this.characterClass = characterClass;

        // Position and movement
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation

        // Stats (can be overridden by subclasses)
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.moveSpeed = 8;
        this.jumpForce = 12;
        this.isGrounded = true;

        // Combat
        this.targetEnemy = null;
        this.attackRange = 2.5;
        this.autoAttackCooldown = 0;
        this.autoAttackCooldownMax = 0.8;
        this.autoAttackDamage = 25;

        // Click-to-move
        this.moveTarget = null;
        this.isMoving = false;

        // Abilities (defined by subclass)
        this.abilities = {};

        // Character controller for animated model
        this.character = new CharacterController(scene, characterClass);
        this.useAnimatedCharacter = false;
        this.characterLoading = false;

        // Fallback mesh group (created by subclass)
        this.group = null;
    }

    /**
     * Load the animated character model
     */
    async loadCharacter() {
        this.characterLoading = true;
        if (this.group) {
            this.group.visible = false;
        }

        try {
            const success = await this.character.load();
            if (success) {
                this.useAnimatedCharacter = true;
                console.log(`${this.characterClass}: Using animated character model`);
            } else if (this.group) {
                this.group.visible = true;
            }
        } catch (error) {
            console.warn(`Failed to load ${this.characterClass} character, using fallback:`, error);
            if (this.group) {
                this.group.visible = true;
            }
        }
        this.characterLoading = false;
    }

    /**
     * Set target enemy for combat
     */
    setTarget(enemy) {
        // Clear previous target highlight
        if (this.targetEnemy && this.targetEnemy.setTargeted) {
            this.targetEnemy.setTargeted(false);
        }

        this.targetEnemy = enemy;

        // Set new target highlight
        if (enemy && enemy.setTargeted) {
            enemy.setTargeted(true);
        }
    }

    /**
     * Set move target for click-to-move
     */
    setMoveTarget(x, z) {
        this.moveTarget = { x, z };
        this.isMoving = true;
    }

    /**
     * Clear move target
     */
    clearMoveTarget() {
        this.moveTarget = null;
        this.isMoving = false;
    }

    /**
     * Handle click-to-move movement
     * @returns {boolean} Whether the player is currently moving
     */
    handleMovement(deltaTime) {
        let isMoving = false;

        // Click-to-move: move toward target
        if (this.moveTarget) {
            const dx = this.moveTarget.x - this.position.x;
            const dz = this.moveTarget.z - this.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.1) {
                isMoving = true;

                // Calculate direction
                const dirX = dx / dist;
                const dirZ = dz / dist;

                // Move toward target
                const moveAmount = Math.min(this.moveSpeed * deltaTime, dist);
                const newX = this.position.x + dirX * moveAmount;
                const newZ = this.position.z + dirZ * moveAmount;

                // Check if new position is walkable
                if (this.canMoveTo(newX, newZ)) {
                    this.position.x = newX;
                    this.position.z = newZ;
                } else {
                    // Try sliding along walls - check X and Z separately
                    if (this.canMoveTo(newX, this.position.z)) {
                        this.position.x = newX;
                    } else if (this.canMoveTo(this.position.x, newZ)) {
                        this.position.z = newZ;
                    } else {
                        // Can't move at all, clear target
                        this.clearMoveTarget();
                    }
                }

                // Face movement direction
                this.rotation = Math.atan2(dirX, dirZ);
            } else {
                // Reached target
                this.clearMoveTarget();
            }
        }

        // Keep in bounds - use dungeon size if available, otherwise default
        let maxBound = 52; // Default for 28x28 dungeon with tileSize=2
        if (this.game && this.game.dungeon) {
            maxBound = (this.game.dungeon.width - 2) * this.game.dungeon.tileSize;
        }
        const minBound = 2; // Stay away from border walls
        this.position.x = Math.max(minBound, Math.min(maxBound, this.position.x));
        this.position.z = Math.max(minBound, Math.min(maxBound, this.position.z));

        this.isMoving = isMoving;
        return isMoving;
    }

    /**
     * Check if the player can move to a world position
     */
    canMoveTo(worldX, worldZ) {
        if (!this.game || !this.game.dungeon) {
            return true; // No dungeon, allow movement
        }
        return this.game.dungeon.isWalkable(worldX, worldZ);
    }

    /**
     * Update ability cooldowns
     */
    updateAbilityCooldowns(deltaTime) {
        for (const key in this.abilities) {
            const ability = this.abilities[key];
            if (ability.cooldownRemaining > 0) {
                ability.cooldownRemaining -= deltaTime;
                if (ability.cooldownRemaining < 0) ability.cooldownRemaining = 0;
            }
        }
    }

    /**
     * Update visual position (animated character or fallback mesh)
     */
    updateVisuals(deltaTime, isMoving) {
        if (this.useAnimatedCharacter) {
            this.character.setPosition(this.position.x, this.position.y, this.position.z);
            this.character.setRotation(this.rotation);
            this.character.update(deltaTime, isMoving, true, this.isGrounded);
        } else if (this.group) {
            this.group.position.copy(this.position);
            this.group.rotation.y = this.rotation;
        }
    }

    /**
     * Take damage from an attack
     */
    takeDamage(amount) {
        this.health -= amount;

        // Play impact animation
        if (this.useAnimatedCharacter) {
            this.character.playImpact();
        }

        // Hit particles
        if (this.game && this.game.particles) {
            this.game.particles.playerHit(this.position);
            this.game.addScreenShake(Math.min(amount / 20, 0.5));
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    /**
     * Handle player death
     */
    die() {
        console.log(`${this.characterClass} died!`);

        // Play death animation
        if (this.useAnimatedCharacter) {
            this.character.playDeath();
        }

        // Reset after delay
        setTimeout(() => {
            this.health = this.maxHealth;
            // Reset to spawn position if available, otherwise center of map
            if (this.game && this.game.dungeon) {
                const spawn = this.game.dungeon.getSpawnPosition();
                this.position.set(spawn.x, 0, spawn.z);
            } else {
                this.position.set(15, 0, 15);
            }
            if (this.useAnimatedCharacter) {
                this.character.playAnimation('idle', true);
            }
        }, 2000);
    }

    /**
     * Use health potion (shared ability)
     */
    usePotion() {
        const ability = this.abilities.potion;
        if (!ability || ability.cooldownRemaining > 0) return false;

        ability.cooldownRemaining = ability.cooldown;
        this.health = Math.min(this.maxHealth, this.health + ability.healAmount);

        // Healing effect
        if (this.game && this.game.effects) {
            this.game.effects.createPotionEffect(this.position);
            this.game.effects.createDamageNumber(this.position, ability.healAmount, true);
        }

        // Heal particles
        if (this.game && this.game.particles) {
            this.game.particles.healEffect(this.position);
        }

        return true;
    }

    // Abstract methods - must be implemented by subclasses
    createMesh() {
        throw new Error('createMesh() must be implemented by subclass');
    }

    update(deltaTime) {
        throw new Error('update() must be implemented by subclass');
    }

    performAutoAttack() {
        throw new Error('performAutoAttack() must be implemented by subclass');
    }
}
